#!/usr/bin/env node
import chalk from "chalk";
import chalkAnimation from "chalk-animation";
import { error } from "console";
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
  let dir = join(__dirname, path);
  let files = readdirSync(dir);
  //  console.log("batch",files.length)
  for (let i in files) {
    let file = files[i];

    let imageBuffer = await sharp(join(dir, file)).toBuffer();

    await sharp(imageBuffer)
      .metadata()
      .then(async ({ width, height }) => {
        // width > height
        if (width > height) {
          //console.log(width,height,file)
          let left = await sharp(imageBuffer)
            // divide into 2 parts 0 to width/2 and width/2 to width
            .extract({ width: width / 2, height, left: 0, top: 0 })
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
                .extract({ width: width / 2, height, left: width / 2, top: 0 })
               .grayscale()
                .png({ quality: 5 })
                .toBuffer();
              await sharp(right)
                .trim()
                .toFile(
                  `./extracted/${filename}/${file}`.replace(".png", "-1.png")
                )
                .then(async () => {
                  //remove original
                  // console.log("removing",file)
                  files.splice(i, 1);
                  unlink(`./extracted/${filename}/${file}`, (err) => {
                    if (err) throw err;
                  });
                });
            });
        } else {
          sharp(imageBuffer)
            .grayscale()
            .trim()
            .png({ quality: 5 })
            .toFile(`./extracted/${filename}/${file}`);
        }
      });
    // .then(() => {
    //   console.log("done processing")

    // });
  }

  // for (let i in files) {
  //   let file = files[i];
  //   //console.log("file",file)
  //   let trimmed = await sharp(join(dir, file)).trim().jpeg().toBuffer();
  //   await sharp(trimmed).toFile(`./extracted/${filename}/${file}`);
  //   // .then(() => {
  //   //   console.log("done trimming", file)

  //   // })
  // }

  //processingImage.success()
};

const convertToEpub = async (filename, index) => {
  // console.log(chalk.greenBright("Converting to Epub..."));
  let sequence = (metaDataAnswers.startIndex || 0) + index;
  let dir = join(__dirname, `./extracted/${filename}`);
  let files = readdirSync(dir);
  let cover = join(dir, files[0]);
  let images = files.map((file) => join(dir, file));
  files.shift();

  var metadata = {
    id: new Date(),
    cover: cover,
    title: filename,
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

const unziper = async (filePath, filename, index) => {
  const extractingImage = createSpinner(
    chalk.magentaBright("Extracting images...")
  ).start();
  // console.log(chalk.greenBright("Extracting images..."));
  createReadStream(filePath)
    .pipe(
      unzipper.Extract({
        path: `./extracted/${filename}`,
      })
    )
    .on("close", async () => {
      extractingImage.success();
      const processingImage = createSpinner(
        chalk.yellowBright("Processing images...")
      ).start();
      await processImage(`./extracted/${filename}`, filename);
      processingImage.success();
      const toEpub = createSpinner(
        chalk.blueBright(`Converting ${filename} to epub...`)
      ).start();
      await convertToEpub(filename, index);
      toEpub.success();
    })
    .on("error", (err) => {
      extractingImage.error({
        text: err || "Something went wrong.",
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
  for (let i in files) {
    let file = files[i];

    await unziper(join(dir, file), file, i);
  }
};

await welcome();
await readDirectory();
