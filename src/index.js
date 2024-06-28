import { mkdir } from "fs/promises";
import express from "express";
import sharp from "sharp";
import { BlobServiceClient } from "@azure/storage-blob";
import dotenv from "dotenv";
import completeWebhookHandshake from "./utils/completeWebhookHandshake.js";
import { v4 as uuid } from "uuid";
import { createZipFile, uploadZipFile } from "./utils/zip-utils.js";

const app = express();
const port = 3000;
dotenv.config();

app.use(express.json());

const blobServiceClient = BlobServiceClient.fromConnectionString(
  process.env.AZURE_BLOB_STORAGE_CONNECTION_STRING
);

const targetImageSizes = [
  { name: "thumbnail", width: 200, height: 200 },
  { name: "medium", width: 600, height: 600 },
  { name: "large", width: 1000 },
];

const outputContainerName = "resized-images";

const supportedImageTypes = ["image/png", "image/jpg", "image/jpeg"];

async function handleBlobEvent(eventObj) {
  if (
    eventObj.eventType == "Microsoft.Storage.BlobCreated" &&
    supportedImageTypes.includes(eventObj.data.contentType)
  ) {
    const blobURL = eventObj.data.url;
    const urlParts = blobURL.split("/");
    const containerName = urlParts[3];
    const blobName = urlParts[4];

    const blobUUID = uuid();

    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blobClient = containerClient.getBlobClient(blobName);

    const downloadedFilePath = `files_to_be_processed/${blobUUID}-${blobName}`;
    await blobClient.downloadToFile(downloadedFilePath);

    const resizedImageDir = `processed_images/${blobUUID}`;
    await mkdir(resizedImageDir);

    await resizeImages(downloadedFilePath, resizedImageDir, blobName);

    const zipFilePath = await createZipFile(resizedImageDir, blobUUID);

    await uploadZipFile(
      zipFilePath,
      blobUUID,
      blobName,
      outputContainerName,
      blobServiceClient
    );

    console.log(`Completed processing for ${blobName}`);
  }
}

async function resizeImages(downloadedFilePath, resizedImageDir, blobName) {
  for (const size of targetImageSizes) {
    const resizedFilePath = `${resizedImageDir}/${size.name}-${blobName}`;
    await sharp(downloadedFilePath)
      .resize(size.width || null, size.height || null)
      .toFile(resizedFilePath);
  }
}

app.post("/process-image", async (req, res) => {
  for (const eventObj of req.body) {
    completeWebhookHandshake(eventObj);
    await handleBlobEvent(eventObj);
  }

  res.send("completed webhook run");
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});
