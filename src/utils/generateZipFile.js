import { createWriteStream } from "fs";

const generateZipFile = async (zip, zipFilePath, blobUUID) => {
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

export default generateZipFile;
