import { readdirSync, statSync, rmdirSync, renameSync, rmdir, rmSync } from 'fs'
import path, { join } from 'path'
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
function isEmpty(path) {
    return readdirSync(path).length === 0;
}