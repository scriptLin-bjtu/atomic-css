const fs = require('fs').promises;
const knownProps = require('known-css-properties').all;
const path = require('path');
const {prefixmap,quickmap} = require('./atomic_quickmap');

const filePath = process.argv[2];//监听到的变化文件

const rootCssPath = path.join(__dirname, '_atomic.css');

function camelCaseToDashCase(string) {
    return string.replace(/[A-Z]/g, match => '-' + match.toLowerCase());
}

function isCssProperty(prop) {
    return knownProps.includes(prop);
}

function parseColonPair(str) {
  const match = str.match(/^(.+?):(.+)$/);
  if (match) {
    return {
      prefix: match[1],
      key: match[2]
    };
  } else {
    return false;
  }
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

extractClassNames(filePath).then(async(result) =>{
  try {
    // 先读取 _atomic.css 文件的内容
    let existingContent = '';
    try {
      existingContent = await fs.readFile(rootCssPath, 'utf-8');
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.error('读取 _atomic.css 文件出错：', err);
        return;
      }
      // 如果文件不存在，初始化为空字符串
      existingContent = '';
    }

    let content = ``;
    let curClassStyle='';
    for (let c of result) {
      if (!existingContent.includes(`.${c}{`)) {
        let [name, value] = c.split('-');
        let prefix = '';
        let v='';
        const prefixobj = parseColonPair(name);
        if(prefixobj){
          prefix=prefixobj.prefix;
          name=prefixobj.key;
        }
        
        if (isCssProperty(camelCaseToDashCase(name)) && value) {
          // 检查类名是否已经存在
          curClassStyle=`.${c}{${camelCaseToDashCase(name)}:${value}}\n`;
          v=`${camelCaseToDashCase(name)}:${value}`;
        }else if(quickmap.has(name) && value){
          curClassStyle=`.${c}{${quickmap.get(name)}:${value}}\n`;
          v=`${quickmap.get(name)}:${value}`;
        }else if(quickmap.has(name) && !value){
          curClassStyle=`.${c}{${quickmap.get(name)}}\n`;
          v=`${quickmap.get(name)}`;
        }else continue;

        if(prefix.length>0 && prefixmap.has(prefix)){//有前缀的处理
          const prefixValue=prefixmap.get(prefix);
          if(prefixValue.includes('@media')){//媒体查询
            curClassStyle=`${prefixmap.get(prefix)}{\n.${prefix}\\:${name+(value?'-'+value:'')}{${v}}\n}\n`;
          }else if(prefixValue==prefix){//伪类
            curClassStyle=`.${prefix}\\:${name+(value?'-'+value:'')}:${prefixValue}{${v}}\n`;
          }
        }

        if(!existingContent.includes(curClassStyle)){//再次判断
          content += curClassStyle;
          existingContent += curClassStyle;//避免重复读取文件，临时加入变量
        }
      }
    }

    // 追加内容到根目录的 _atomic.css
    if (content) {
      await appendToFile(rootCssPath, content);
    }
  } catch (err) {
    console.error('处理类名时出错：', err);
  }
});
