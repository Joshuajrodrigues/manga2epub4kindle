import { readdirSync, statSync, rmdirSync, renameSync, rmdir, rmSync } from 'fs'
import path, { extname, join } from 'path'
import { supportedFiles } from './constants.js';

export const moveFilesToTopLevel = async (dir,filename) => {
    const files = readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        if (statSync(filePath).isDirectory() ) {
            await moveFilesToTopLevel(filePath,filename);
         if(isEmpty(filePath)){
             rmdirSync(filePath)
         }
        } else {
            renameSync(filePath, path.join(`./extracted/${filename}`, file));

        }
    }
}

export const checkValidFiles = async (files) => {
    let count = 0
    let isMetadata = false
    for (let i = 0; i < files.length; i++) {
        let file = files[i]
        let extention = extname(file)
        if (supportedFiles.includes(extention)) {
            count++
        }
        if (file === 'metadata.json') {
            isMetadata = true
        }

    }
    return { count, isMetadata };
}

export const checkforMetadata = async (files) => {
    let isMetadata = false
    for (let i = 0; i < files.length; i++) {
        let file = files[i]
        console.log(file)
        if (file === 'metadata.json') {
            isMetadata = true
        }
    }
    return isMetadata
}



function isEmpty(path) {
    return readdirSync(path).length === 0;
}