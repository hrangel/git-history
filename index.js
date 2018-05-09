const { lstatSync, readdirSync } = require('fs')
const { join } = require('path')
const fs = require('fs');
const { exec } = require('child_process');

const isDirectory = source => lstatSync(source).isDirectory()
const getDirectories = source =>
  readdirSync(source).map(name => join(source, name)).filter(isDirectory)

const hasGitDirectory = dir => {
  return (fs.existsSync(join(dir, ".git")));
}

const getGitDirectories = source => {
  const dirs = getDirectories(source);
  const gitDirs = [];
  for (const dir of dirs) {
    if (hasGitDirectory(dir)) {
      gitDirs.push(dir);
    } else {
      const subDirs = getGitDirectories(dir);
      if (subDirs.length > 0) {
        gitDirs.push.apply(gitDirs, subDirs);
      }
    }
  }
  return gitDirs;
};

const runOnGitDirs = (source, getCmdCallback, resultCallback) => {
  const dirs = getGitDirectories(source);
  const promises = [];
  for (const dir of dirs) {
    const cmd = getCmdCallback(dir);
    promises.push(new Promise((resolve, reject) => {
      exec(cmd, (err, stdout, stderr) => {
        if (err) {
          // node couldn't execute the command
          // throw err;
          resolve(err);
          return;
        }
  
        resolve(resultCallback(dir, stdout));
      });
    }));
  }
  if (promises.length > 0) {
    return Promise.all(promises);
  } else
    return Promise.resolve([]);
  
};

const getDirHistory = (source, author, dateStart, dateEnd) => {
  const allResults = [];
  return runOnGitDirs(source, dir => { 
    if (author) {
      return `cd "${dir}" && git log --pretty="format:%h %ci %s" --abbrev-commit --after="${dateStart}" --before="${dateEnd}" --author="${author}"`;
    } else {
      return `cd "${dir}" && git log --pretty="format:%h %ci %s" --abbrev-commit --after="${dateStart}" --before="${dateEnd}"`;
    }
  }, (dir, stdout) => {
    if (stdout && stdout.length > 0) {
      const item = { dir, content: stdout };
      allResults.push(item)
      return item;
    }
  }).then(result => {
    return allResults;
  });
}

const writeToPath = (content, filepath) => {
  return new Promise((resolve, reject) => {
      fs.writeFile(filepath, content, function(err) {
          if(err) {
              reject(err);
              return console.log(err);
          } else {
              resolve(filepath);
          }
      }); 
  });
}

const writeDirDayHistory = (source, author, dateStart, dateEnd, file) => {
  return getDirHistory(source, author, dateStart, dateEnd).then(allResults => {
    var content = "";
    for (const result of allResults) {
      const resultContent = result.content.replace(/\n/g,'\n\t');
      content+= `${result.dir}:\n\t${resultContent}\n`
    }
    writeToPath(content, file);
  });
}

const formatDate = (date) => {
  const day = date.getDate() > 9 ? `${date.getDate()}` : `0${date.getDate()}`;
  const month = date.getMonth() > 8 ? `${date.getMonth()+1}` : `0${date.getMonth()+1}`;
  return `${date.getFullYear()}-${month}-${day}`;
}

const writeDirHistory = (source, author, rangeStart, rangeEnd, folder) => {
  var currentDate = new Date(rangeStart.getTime());
  var dates = [];
  while (currentDate < rangeEnd) {
    dates.push(currentDate);
    currentDate = new Date(currentDate.getTime());
    currentDate.setDate(currentDate.getDate()+1);
  }
  const myPromise = date => {
    const dateStart = `${formatDate(date)} 00:00`;
    const dateEnd = `${formatDate(date)} 23:59`;
    const fileId = `${formatDate(date)}`;
    const file = join(folder, `${fileId}.txt`)
    console.log('writing: ', fileId);
    return writeDirDayHistory(source, author, dateStart, dateEnd, file);
  }
  // roda na sequencia para evitar erros
  return dates.reduce(
    (p, x) =>
      p.then(_ => myPromise(x)),
    Promise.resolve()
  )
};

module.exports = {
  writeDirHistory
}

// var gitHistory = require('./index')
// gitHistory.writeDirHistory("/Users/henrique-rangel/Projects", "Rangel", new Date(2018, 03, 09), new Date(2018, 04, 01), "./history")