#!/usr/bin/env node
import chalk from "chalk";
import chalkAnimation from "chalk-animation";
import { createReadStream, readdirSync, readFile, readFileSync, rmSync, unlink, writeFile, writeFileSync } from "fs";
import inquirer from "inquirer";
import { createSpinner } from "nanospinner";
import nodepub from "nodepub";
import { dirname, extname, join } from "path";
import sharp from "sharp";
import unzipper from "unzipper";
import { fileURLToPath } from "url";
import { supportedFiles } from "./utils/constants.js";
import { checkforMetadata, checkValidFiles, moveFilesToTopLevel } from "./utils/index.js";

// sharp.cache(false);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let metaDataAnswers = {
  series: "",
  author: "",
};
let startIndex

let selectedFiles = []
const sleep = (ms = 2000) => new Promise((r) => setTimeout(r, ms));

const welcome = async () => {
  const intro = chalkAnimation.rainbow("Welcome to Manga2epub4kindle 🍺");
  await sleep();
  intro.stop();
  console.log(`
    ${chalk.blueBright(
      "Make sure you ran me in a folder full of cbz/cbr files."
    )}
  `);
};

const processImage = async (path, filename) => {
  //console.log("filename", filename)
  await moveFilesToTopLevel('./extracted', filename)
  return new Promise(async (resolve, reject) => {
    let dir = join(__dirname, path);
    let files = readdirSync(dir);
    for (let i in files) {
      let file = files[i];
      let imageBuffer = await sharp(join(dir, file)).resize({
        width:1072,
        height:1448,
        fit:"fill"
        
      }).toFormat("jpeg").toBuffer();
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
  let sequence = `${(Number(startIndex) || 0) + index}`;
  
  //console.log("sequence",sequence,(metaDataAnswers.startIndex || 0),index)
  let dir = join(__dirname, `./extracted/${filename}`);
  let files = readdirSync(dir);
  let cover = join(dir, files[0]);
  let images = files.map((file) => join(dir, file));
  //files.shift();

  var metadata = {
    id: new Date(),
    cover: cover,
    title: filename.replace(".cbz", "").replace(".cbr", ""),
    series: metaDataAnswers.series || "",
    sequence,
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
    .writeEPUB("./epub", filename.replace(".zip", "").replace(".cbz", "").replace(".cbr", ""))
    .then(async () => {
      rmSync(`./extracted/${filename}`, { recursive: true });
      await saveMetaDataToFile(metaDataAnswers)
    });
};

const unZipFiles = (filePath, filename) => {
  return new Promise((resolve, reject) => {
    createReadStream(filePath)
      .pipe(
       //unzipper.Parse()
        unzipper.Extract({
          path: `./extracted/${filename}`,
        })
      )
      .on("close", () => {
        resolve(true);
      });
  });
};

const metaDataQuestions = async (count) => {

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
    choices: ["Paperwhite 11th Generation"],
    default() {
      return "Paperwhite 11th Generation";
    },
  });
  let q6 = await inquirer.prompt({
    name: "startIndex",
    type: "input",
    message: "Select start index for series (Volume number starts from)",
    default() {
      return "0";
    },
  });

  metaDataAnswers.series = q1.series;
  metaDataAnswers.author = q2.author;
  metaDataAnswers.genre = q3.genre;
  metaDataAnswers.publisher = q4.publisher;
  metaDataAnswers.kindle = q5.kindle;
  startIndex = q6.startIndex;
  console.log("Your metadata: ", metaDataAnswers);

  let q7 = await inquirer.prompt({
    name: "saveMeta",
    type: "confirm",
    message: "Would you like to save this metadata for future use ?"
  })
  if (q7.saveMeta) {
    await saveMetaDataToFile()
  }
};

const loadMetaDataFromFile = async (count) => {
  return new Promise((resolve,reject)=>{
    let metaData = {}
    readFile('./metadata.json', async (err, data) => {
      if(err) throw err
      metaData = JSON.parse(data)
      let q7 = await inquirer.prompt({
        name: "loadMeta",
        type: "confirm",
        message:chalk.yellow(`Would you like to use this data ?

${JSON.stringify(metaData,null,2)}


`)
      })

      if (q7.loadMeta) {
        let q6 = await inquirer.prompt({
          name: "startIndex",
          type: "input",
          message: "Select start index for series (Volume number starts from)",
          default() {
            return "0";
          },
        });
        startIndex = q6.startIndex;
         metaDataAnswers = metaData
        resolve()
      }else{
         await metaDataQuestions(count)
        resolve()
      }
    })
  })
}

const saveMetaDataToFile = async (metaData = metaDataAnswers) => {
  writeFileSync('./metadata.json', JSON.stringify(metaData), (err) => {
    if (err) throw err
  })
}

const readDirectory = async () => {

  let dir = __dirname;
  let files = readdirSync(dir);

  let { count, isMetadata } = await checkValidFiles(files)
  let validFiles = files.filter((item) => supportedFiles.includes(extname(item)))
  console.log(chalk.underline(`Found ${count} valid file/s.`))
  let filesToProcess = await inquirer.prompt({
    name: "filesToSkip",
    pageSize: 25,
    type: "checkbox",
    message: "Select files to process",
    choices: validFiles
  })
  selectedFiles = filesToProcess.filesToSkip

  if (isMetadata) {
    await loadMetaDataFromFile(count)
  } else {
    await metaDataQuestions(count);
  }



  for (let i = 0; i < validFiles.length; i++) {

    let file = validFiles[i];
    if (!selectedFiles.includes(file)) continue

    const extractSpinner = createSpinner('Extracting files...').start()
    const isExtracted = await unZipFiles(join(dir, file), file);
    if (isExtracted) extractSpinner.success()

    const processSpinner = createSpinner('Processing files...').start()
    let isProcessed = await processImage(`./extracted/${file}`, file);
    if (isProcessed) processSpinner.success()

    const convertingSpinner = createSpinner('Converting to epub...').start()
   await convertToEpub(file, i);
   convertingSpinner.success({ text: `${file} converted to epub 🍻` })

  }
};



await welcome();
await readDirectory();
