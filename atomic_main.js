const fs = require('fs').promises;
const knownProps = require('known-css-properties').all;
const path = require('path');
const filePath = process.argv[2];//监听到的变化文件

const rootCssPath = path.join(__dirname, '_atomic.css');

function camelCaseToDashCase(string) {
    return string.replace(/[A-Z]/g, match => '-' + match.toLowerCase());
}

function isCssProperty(prop) {
    return knownProps.includes(prop);
}

async function extractClassNames(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');

    // 匹配所有 class="..."
    const classRegex = /class="([^"]*)"/g;
    const classNames = [];

    let match;
    while ((match = classRegex.exec(content)) !== null) {
      // 把 class 中的每一个类名拆分出来
      const classes = match[1].trim().split(/\s+/);
      classNames.push(...classes);
    }

    // 去重
    const result = [...new Set(classNames)];
    return result;
  } catch (err) {
    console.error('读取或处理文件出错：', err);
    return '';
  }
}

async function appendToFile(filePath, content) {
  try {
    await fs.appendFile(filePath, content, 'utf-8');
    console.log('新内容写入成功！');
  } catch (err) {
    console.error('新内容写入失败：', err);
  }
}

async function classExistsInFile(filePath, className) {
  try {
      const content = await fs.readFile(filePath, 'utf-8');
      return content.includes(`.${className} {`);
  } catch (err) {
      // 如果文件不存在，返回 false
      if (err.code === 'ENOENT') {
          return false;
      }
      console.error('检查类名是否存在时出错：', err);
      return false;
  }
}

extractClassNames(filePath).then(async(result) =>{
  let content=``;
  for (const c of result) {
    const [name, value] = c.split('-');
    if (isCssProperty(camelCaseToDashCase(name)) && value) {
        // 检查类名是否已经存在
        const exists = await classExistsInFile(rootCssPath, c);
        if (!exists) {
            content += `.${c} { ${camelCaseToDashCase(name)}: ${value}; }\n`;
        }
    }
}
// 追加内容到根目录的 _atomic.css
if (content) {
    await appendToFile(rootCssPath, content);
}
});
