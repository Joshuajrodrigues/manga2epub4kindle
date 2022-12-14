import { readdirSync, statSync, rmdirSync, renameSync } from 'fs'
import path from 'path'
export const moveFilesToTopLevel = async (dir, filename) => {
    const files = readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        if (statSync(filePath).isDirectory()) {
            await moveFilesToTopLevel(filePath, filename);
            rmdirSync(filePath);
        } else {
            let array = dir.split('\\')
            array.pop()
            let newPath = array.join('\\')
            // console.log("newPAth:", newPath)
            renameSync(filePath, path.join(newPath, file));
        }
    }
}