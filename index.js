#!/usr/bin/env node
import chalk from "chalk";
import figlet from "figlet";
import { createReadStream, readdirSync, rmSync, unlink } from "fs";
import gradient from "gradient-string";
import inquirer from "inquirer";
import { si, pantsu } from "nyaapi";
import { dirname, join } from "path";
import webTorrent from "webtorrent";
import { fileURLToPath } from "url";
import unzip from "unzip";
import nodepub from "nodepub";
import chalkAnimation from "chalk-animation";
import sharp from "sharp";

sharp.cache(false);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let seatchTerm = "";
let searchResuls = [];
let metaDataAnswers = {
  series: "",
  author: "",
};

const sleep = (ms = 2000) => new Promise((r) => setTimeout(r, ms));

const welcome = async () => {
  const msg = "Welcome to Mangler";
  const intro = chalkAnimation.pulse(msg);
  await sleep();
  intro.stop();
};

const processImage = async (path, filename) => {
  console.log(chalk.greenBright("Processing images..."));
  let dir = join(__dirname, path);
  let files = readdirSync(dir);
  files?.map((file, index) => {
    sharp(join(dir, file))
      .metadata()
      .then(({ width, height }) => {
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
                  unlink(`./extracted/${filename}/${file}`, (err) => {
                    if (err) throw err;
                    else return true
                  });
                });
            });
        }
      });
  });
  
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
  await epub.writeEPUB("./epub", filename).then(() => {
    rmSync(`./extracted/${filename}`, { recursive: true });
  });
};

const unziper = async (filePath, filename, index) => {
  console.log(chalk.greenBright("Extracting images..."));
  const stream = createReadStream(filePath).pipe(
    unzip.Extract({
      path: `./extracted/${filename}`,
    })
  );
  stream.on("close", async () => {
    await processImage(`./extracted/${filename}`, filename)
  });
};

const metaDataQuestions = async () => {
  let q1 = await inquirer.prompt({
    name: "series",
    type: "input",
    message: "Enter series name",
  });
  let q2 = await inquirer.prompt({
    name: "author",
    type: "input",
    message: "Enter author name",
  });

  // select kindle
  // add genre
  // add tags
  // add publisher
  metaDataAnswers.author = q2.author;
  metaDataAnswers.series = q1.series;
};

const readDirectory = async () => {
  await metaDataQuestions();

  let dir = join(__dirname, "./testDir");
  let files = readdirSync(dir);
  files.map(async(file, index) =>{ 
    await unziper(join(dir, file), file, index)
    await convertToEpub(file, index);
});
};

await welcome();
await sleep(100);
await readDirectory();

const searchManga = async () => {
  let answer = await inquirer.prompt({
    name: "mangaSearchTerm",
    type: "input",
    message: "Enter Search Term :",
  });
  seatchTerm = answer.mangaSearchTerm;
};
const webTorrentClient = async (torrent) => {
  const client = new webTorrent();
  const magnetUri = torrent.magnet;
  client.add(magnetUri, { path: "./torrents" }, function (torrent) {
    torrent.on("done", () => {
      console.log("torrent download finished.");
    });
  });
};

const searchResults = async (data) => {
  let answer = await inquirer.prompt({
    name: "magnetLink",
    type: "rawlist",
    message: "Choose",
    choices: [...data],
  });
  let torrent = await searchResuls.find(
    (item) => item.id + "==" + item.name == answer.magnetLink
  );
  await webTorrentClient(torrent);
};
const display = async () => {
  let sd = [];
  if (seatchTerm) {
    si.search(seatchTerm, 20, {
      filter: 1,
      category: "3_1",
    })
      .then(async (data) => {
        searchResuls = data;
        sd = data.map((item) => item.id + "==" + item.name);
        await searchResults(sd);
      })
      .catch((err) => console.log(err));
  }
};
