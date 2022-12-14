#!/usr/bin/env node
import chalk from "chalk";
import chalkAnimation from "chalk-animation";
import { createReadStream, readdirSync, rmSync, unlink } from "fs";
import inquirer from "inquirer";
import { createSpinner } from "nanospinner";
import nodepub from "nodepub";
import { dirname, join } from "path";
import sharp from "sharp";
import unzipper from "unzipper";
import { fileURLToPath } from "url";

// sharp.cache(false);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let metaDataAnswers = {
  series: "",
  author: "",
};

const sleep = (ms = 2000) => new Promise((r) => setTimeout(r, ms));

const welcome = async () => {
  const intro = chalkAnimation.rainbow("Welcome to Manga2epub4kindle 🍺");
  await sleep();
  intro.stop();
  console.log(`
    ${chalk.blueBright(
      "Make sure you ran me in a folder full of cbr/cbz files."
    )}
  `);
};

const processImage = async (path, filename) => {
  return new Promise(async (resolve, reject) => {
    let dir = join(__dirname, path);
    let files = readdirSync(dir);
    for (let i in files) {
      let file = files[i];
      let imageBuffer = await sharp(join(dir, file)).toBuffer();
      let imageMetaData = await sharp(imageBuffer).metadata();
      if (imageMetaData.width > imageMetaData.height) {
        //console.log(width,height,file)
        let left = await sharp(imageBuffer)
          // divide into 2 parts 0 to width/2 and width/2 to width
          .extract({
            width: imageMetaData.width / 2,
            height: imageMetaData.height,
            left: 0,
            top: 0,
          })
          //add these 2 images instead of the original
          .grayscale()
          .png({ quality: 5 })
          .toBuffer();
        await sharp(left)
          .trim()
          .toFile(`./extracted/${filename}/${file}`.replace(".png", "-2.png"))
          .then(async () => {
            //console.log("i run",file)
            let right = await sharp(imageBuffer)
              .extract({
                width: imageMetaData.width / 2,
                height: imageMetaData.height,
                left: imageMetaData.width / 2,
                top: 0,
              })
              .grayscale()
              .png({ quality: 5 })
              .toBuffer();
            await sharp(right)
              .trim()
              .toFile(
                `./extracted/${filename}/${file}`.replace(".png", "-1.png")
              );

            files.splice(i, 1);
            unlink(`./extracted/${filename}/${file}`, (err) => {
              if (err) throw err;
            });
          });
      } else {
        sharp(imageBuffer)
          .grayscale()
          .trim()
          .png({ quality: 5 })
          .toFile(`./extracted/${filename}/${file}`);
      }
    }
    resolve(true);
  });
};

const convertToEpub = async (filename, index) => {
  let sequence = (Number(metaDataAnswers.startIndex) || 0) + index;
  //console.log("sequence",sequence,(metaDataAnswers.startIndex || 0),index)
  let dir = join(__dirname, `./extracted/${filename}`);
  let files = readdirSync(dir);
  let cover = join(dir, files[0]);
  let images = files.map((file) => join(dir, file));
  //files.shift();

  var metadata = {
    id: new Date(),
    cover: cover,
    title: filename.replace(".cbz",""),
    series: metaDataAnswers.series || "",
    sequence: `${sequence}`,
    author: metaDataAnswers.author || "",
    fileAs: metaDataAnswers.author.split(" ").reverse().join(", "),
    genre: metaDataAnswers.genre,
    publisher: metaDataAnswers.publisher,
    language: "en",
    showContents: false,
    images: images,

    pageDirection: "rtl",
    originalResWidth: 1072,
    originalResHeight: 1448,
    kindleComicConverter: true,
  };

  let epub = nodepub.document(metadata);
  files.forEach((image, index) => {
    epub.addSection(
      `Page ${index}`,
      `
      <div style="text-align:center;top:0.0%;">
      <img width="1072" height="1448" src='../images/${image}' />
      </div>
      `
    );
    epub.addCSS(`
    @page {
      margin: 0;
      }
    body {
        display: block;
        margin: 0;
        padding: 0;
        }
        `);
  });
  await epub
    .writeEPUB("./epub", filename.replace(".zip", "").replace(".cbz", ""))
    .then(() => {
      rmSync(`./extracted/${filename}`, { recursive: true });
    });
};

const unZipFiles = (filePath, filename) => {
  return new Promise((resolve, reject) => {
    createReadStream(filePath)
      .pipe(
        unzipper.Extract({
          path: `./extracted/${filename}`,
        })
      )
      .on("close", () => {
        resolve(true);
      });
  });
};

const metaDataQuestions = async () => {
  let q1 = await inquirer.prompt({
    name: "series",
    type: "input",
    message: "Enter series name",
    default() {
      return "Default Series";
    },
  });
  let q2 = await inquirer.prompt({
    name: "author",
    type: "input",
    message: "Enter author name",
    default() {
      return "Default Author";
    },
  });
  let q3 = await inquirer.prompt({
    name: "genre",
    type: "checkbox",
    message: "Enter Genre name",
    choices: [
      "Action",
      "Adventure",
      "Comedy",
      "Drama",
      "Fantasy",
      "Historical",
      "Horror",
      "Mecha",
      "Mystery",
      "One shot",
      "Overpowered MC",
      "Sci-fi",
      "Shonen",
      "Slice of life",
      "Supernatural",
      "Time travel",
      "Other",
    ],
    default() {
      return "";
    },
  });
  let q4 = await inquirer.prompt({
    name: "publisher",
    type: "input",
    message: "Enter publisher name",
    default() {
      return "Default Publisher";
    },
  });
  let q5 = await inquirer.prompt({
    name: "kindle",
    type: "list",
    message: "Select your kindle",
    choices: ["Paperwhite 11th gen", "Basic Kindle"],
    default() {
      return "Paperwhite 11th gen";
    },
  });
  // select kindle
  // add genre
  // add publisher
  let q6 = await inquirer.prompt({
    name: "startIndex",
    type: "text",
    message: "Select start index for series",
    default() {
      return "0";
    },
  });
  metaDataAnswers.author = q2.author;
  metaDataAnswers.series = q1.series;
  metaDataAnswers.genre = q3.genre;
  metaDataAnswers.publisher = q4.publisher;
  metaDataAnswers.kindle = q5.kindle;
  metaDataAnswers.startIndex = q6.startIndex;
  console.log("Your metadata: ", metaDataAnswers);
};

const readDirectory = async () => {
  await metaDataQuestions();
  let dir = join(__dirname, "./testDir");
  let files = readdirSync(dir);
  for (let i = 0; i < files.length; i++) {
    let file = files[i];
    const extractSpinner = createSpinner('Extracting files...').start()
    let isExtracted = await unZipFiles(join(dir, file), file);

    if (isExtracted) {
      extractSpinner.success()
      const processSpinner = createSpinner('Processing files...').start()
      let isProcessed = await processImage(
        `./extracted/${file}`,
        file
      );
      if (isProcessed) {
        processSpinner.success()
        const convertingSpinner = createSpinner('Converting to epub...').start()
        await convertToEpub(file, i);
        convertingSpinner.success({text:`${file} converted to epub 🍻`})
      }
    }
  }
};

await welcome();
await readDirectory();
