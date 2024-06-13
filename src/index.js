import fs from "fs";
import { mkdir, readFile, readdir } from "fs/promises";
import express from "express";
import sharp from "sharp";
import JSZip from "jszip";
import { BlobServiceClient } from "@azure/storage-blob";
import dotenv from "dotenv";
import completeWebhookHandshake from "./utils/completeWebhookHandshake.js";
import { v4 as uuid } from "uuid";
import generateZipFile from "./utils/generateZipFile.js";

const app = express();
const port = 3000;
dotenv.config();

app.use(express.json());

const blobServiceClient = BlobServiceClient.fromConnectionString(
  process.env.AZURE_BLOB_STORAGE_CONNECTION_STRING
);

app.post("/process-image", async (req, res) => {
  const targetImageSizes = [
    { name: "thumbnail", width: 200, height: 200 },
    { name: "medium", width: 600, height: 600 },
    { name: "large", width: 1000 },
  ];

  const supportedImageTypes = ["image/png", "image/jpg", "image/jpeg"];

  for (const eventObj of req.body) {
    completeWebhookHandshake(eventObj);

    if (
      eventObj.eventType == "Microsoft.Storage.BlobCreated" &&
      supportedImageTypes.includes(eventObj.data.contentType)
    ) {
      const blobURL = eventObj.data.url;
      const urlParts = blobURL.split("/");
      const containerName = urlParts[3];
      const blobName = urlParts[4];

      const blobUUID = uuid();

      const containerClient =
        blobServiceClient.getContainerClient(containerName);
      const blobClient = containerClient.getBlobClient(blobName);

      const downloadedFilePath = `files_to_be_processed/${blobUUID}-${blobName}`;
      await blobClient.downloadToFile(downloadedFilePath);

      const resizedImageDir = `processed_images/${blobUUID}`;
      await mkdir(resizedImageDir);

      for (const size of targetImageSizes) {
        const resizedFilePath = `${resizedImageDir}/${size.name}-${blobName}`;
        await sharp(downloadedFilePath)
          .resize(
            size.width ? size.width : null,
            size.height ? size.height : null
          )
          .toFile(resizedFilePath);
      }

      const zip = new JSZip();
      const imagesToZip = await readdir(resizedImageDir);

      for (const imageTitle of imagesToZip) {
        const imageData = await readFile(`${resizedImageDir}/${imageTitle}`);
        zip.file(imageTitle, imageData);
      }

      const zipFilePath = `archived_images/${blobUUID}.zip`;
      await generateZipFile(zip, zipFilePath, blobUUID);

      const outputContainerClient =
        blobServiceClient.getContainerClient("resizedimages");
      const zipFileContent = await readFile(zipFilePath);
      const zipBlobName = `${blobUUID}-${blobName}.zip`;
      const zipBlobClient =
        outputContainerClient.getBlockBlobClient(zipBlobName);

      const uploadBlobResponse = await zipBlobClient.upload(
        zipFileContent,
        zipFileContent.length
      );
      console.log(
        `Upload block blob ${zipBlobName} successfully`,
        uploadBlobResponse.requestId
      );
    }
  }

  res.send("completed webhook run");
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});
