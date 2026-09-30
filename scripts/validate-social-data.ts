import {readFile} from 'node:fs/promises';
import {WorkbookFile,buildAnalytics} from '../lib/social/analytics';
import {checkMirror} from '../lib/social/github';
const [workbookFile,scoutFile]=process.argv.slice(2);
if(!workbookFile||!scoutFile){console.error('Usage: npm run social:validate -- workbook.json scout-run.json');process.exitCode=1;}
else try{
 const workbook=WorkbookFile.parse(JSON.parse(await readFile(workbookFile,'utf8')));buildAnalytics(workbook.tabs);
 checkMirror(workbook,JSON.parse(await readFile(scoutFile,'utf8')));console.log('Workbook and scout run are valid and consistent.');
}catch{console.error('Validation failed. Check workbook headers, scout schema, unique IDs and matching mirrored rows.');process.exitCode=1;}
