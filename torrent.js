
// const searchManga = async () => {
//   let answer = await inquirer.prompt({
//     name: "mangaSearchTerm",
//     type: "input",
//     message: "Enter Search Term :",
//   });
//   seatchTerm = answer.mangaSearchTerm;
// };
// const webTorrentClient = async (torrent) => {
//   const client = new webTorrent();
//   const magnetUri = torrent.magnet;
//   client.add(magnetUri, { path: "./torrents" }, function (torrent) {
//     torrent.on("done", () => {
//       console.log("torrent download finished.");
//     });
//   });
// };

// const searchResults = async (data) => {
//   let answer = await inquirer.prompt({
//     name: "magnetLink",
//     type: "rawlist",
//     message: "Choose",
//     choices: [...data],
//   });
//   let torrent = await searchResuls.find(
//     (item) => item.id + "==" + item.name == answer.magnetLink
//   );
//   await webTorrentClient(torrent);
// };
// const display = async () => {
//   let sd = [];
//   if (seatchTerm) {
//     si.search(seatchTerm, 20, {
//       filter: 1,
//       category: "3_1",
//     })
//       .then(async (data) => {
//         searchResuls = data;
//         sd = data.map((item) => item.id + "==" + item.name);
//         await searchResults(sd);
//       })
//       .catch((err) => console.log(err));
//   }
// };
