#!/usr/bin/env node
import chalk from "chalk";
import chalkAnimation from "chalk-animation";
import { createReadStream, readdirSync, rmSync, unlink } from "fs";
import inquirer from "inquirer";
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

const sleep = (ms = 2000) => new Promise((r) => setTimeout(r, ms))

const welcome = async () => {
  const intro = chalkAnimation.rainbow("Welcome to Mangapub 🍺");
  await sleep();
  intro.stop();
  console.log(`
    ${chalk.redBright('Make sure you ran me in a folder full of cbr/cbz files.')}
  `)
};

const processImage = async (path, filename) => {
  console.log(chalk.greenBright("Processing images..."));
  let dir = join(__dirname, path);
  let files = readdirSync(dir);
  for (let i in files) {
    let file = files[i]
    await sharp(join(dir, file))
      .trim()
      .metadata()
      .then(async ({ width, height }) => {
        // width > height
        if (width > height) {
          sharp(join(dir, file))
            // divide into 2 parts 0 to width/2 and width/2 to width
            .extract({ width: width / 2, height, left: 0, top: 0 })
            //add these 2 images instead of the original
            .toFile(`./extracted/${filename}/${file}`.replace(".png", "-2.png"))
            .then(() => {
              sharp(join(dir, file))
                .extract({ width: width / 2, height, left: width / 2, top: 0 })
                .toFile(
                  `./extracted/${filename}/${file}`.replace(".png", "-1.png")
                )
                .then(() => {
                  //remove original
                  files.splice(i, 1)
                  unlink(`./extracted/${filename}/${file}`, (err) => {
                    if (err) throw err;

                  });
                });
            });
        }

      })
    // .then(() => {
    //   console.log("done processing")

    // });
  }

  for (let i in files) {
    let file = files[i]
    let trimmed = await sharp(join(dir, file))
      .trim()
      .toBuffer();
    await sharp(trimmed)
      .toFile(`./extracted/${filename}/${file}`)
    // .then(() => {
    //   console.log("done trimming", file)

    // })
  }


  readExtracted()

};


const convertToEpub = async (filename, index) => {
  console.log(chalk.greenBright("Converting to Epub..."));

  let dir = join(__dirname, `./extracted/${filename}`);
  let files = readdirSync(dir);
  let cover = join(dir, files[0]);
  let images = files.map((file) => join(dir, file));
  files.shift();
  var metadata = {
    id: new Date(),
    cover: cover,
    title: filename,
    series: metaDataAnswers.series,
    sequence: `${index}`,
    author: metaDataAnswers.author,
    fileAs: metaDataAnswers.author.split(" ").reverse().join(", "),
    genre: "Non-Fiction",
    tags: "Sample,Example,Test",
    language: "en",
    showContents: false,
    images: images,
  };

  let epub = nodepub.document(metadata);
  files.forEach((image, index) => {
    epub.addSection(
      `Page ${index}`,
      `<img width="1072" height="1448" src='../images/${image}' />`
    );
  });
  await epub.writeEPUB("./epub", filename.replace(".zip", '')).then(() => {
    rmSync(`./extracted/${filename}`, { recursive: true });
  });
};

const unziper = async (filePath, filename, index) => {
  console.log(chalk.greenBright("Extracting images..."));
  createReadStream(filePath)
    .pipe(unzipper.Extract({
      path: `./extracted/${filename}`,
    }))
    .on('close', async () => {
      await processImage(`./extracted/${filename}`, filename);

    })
};

const metaDataQuestions = async () => {
  let q1 = await inquirer.prompt({
    name: "series",
    type: "input",
    message: "Enter series name",
    default() {
      return ''
    }
  });
  let q2 = await inquirer.prompt({
    name: "author",
    type: "input",
    message: "Enter author name",
    default() {
      return ''
    }
  });
  let q3 = await inquirer.prompt({
    name: "genre",
    type: "input",
    message: "Enter Genre name",
    default() {
      return ''
    }
  });
  let q4 = await inquirer.prompt({
    name: "publisher",
    type: "input",
    message: "Enter publisher name",
    default() {
      return ''
    }
  });
  let q5 = await inquirer.prompt({
    name: "kindle",
    type: "list",
    message: "Select your kindle",
    choices: ["Paperwhite 11th gen", "Basic Kindle"],
    default() {
      return "Paperwhite 11th gen"
    }
  });
  // select kindle
  // add genre
  // add publisher
  metaDataAnswers.author = q2.author;
  metaDataAnswers.series = q1.series;
};

const readDirectory = async () => {
  await metaDataQuestions();

  let dir = join(__dirname, "./testDir");
  let files = readdirSync(dir);
  files.map(async (file, index) => {
    await unziper(join(dir, file), file, index)
  });
};

const readExtracted = async () => {

  let dir = join(__dirname, "./extracted");
  let files = readdirSync(dir);
  files.map(async (file, index) => {
    convertToEpub(file, index)
  });
  console.log("done")
};



await welcome();
await readDirectory();
