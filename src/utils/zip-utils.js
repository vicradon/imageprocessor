import { createWriteStream } from "fs";
import { readFile, readdir } from "fs/promises";
import JSZip from "jszip";

const generateZipFile = async (zip, zipFilePath) => {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(zipFilePath);

    output.on("finish", () => {
      resolve(zipFilePath);
    });

    output.on("error", (err) => {
      reject(err);
    });

    zip
      .generateNodeStream({ type: "nodebuffer", streamFiles: true })
      .pipe(output);
  });
};

async function createZipFile(resizedImageDir, blobUUID) {
  const zip = new JSZip();
  const imagesToZip = await readdir(resizedImageDir);

  for (const imageTitle of imagesToZip) {
    const imageData = await readFile(`${resizedImageDir}/${imageTitle}`);
    zip.file(imageTitle, imageData);
  }

  const zipFilePath = `archived_images/${blobUUID}.zip`;
  await generateZipFile(zip, zipFilePath);

  return zipFilePath;
}

async function uploadZipFile(
  zipFilePath,
  blobUUID,
  blobName,
  outputContainerName,
  blobServiceClient
) {
  const outputContainerClient =
    blobServiceClient.getContainerClient(outputContainerName);
  const zipFileContent = await readFile(zipFilePath);
  const zipBlobName = `${blobUUID}-${blobName}.zip`;
  const zipBlobClient = outputContainerClient.getBlockBlobClient(zipBlobName);

  const uploadBlobResponse = await zipBlobClient.upload(
    zipFileContent,
    zipFileContent.length
  );
  console.log(
    `Upload block blob ${zipBlobName} successfully`,
    uploadBlobResponse.requestId
  );
}

export { uploadZipFile, createZipFile };
