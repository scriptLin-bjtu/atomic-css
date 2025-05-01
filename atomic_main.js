const fs = require('fs').promises;
const knownProps = require('known-css-properties').all;
const path = require('path');
const {prefixmap,quickmap} = require('./atomic_quickmap');
const {configStyle,darkMode} = require('./atomic.config');

const filePath = process.argv[2];//监听到的变化文件

const rootCssPath = path.join(__dirname, 'atomic.style.css');

function camelCaseToDashCase(string) {
    return string.replace(/[A-Z]/g, match => '-' + match.toLowerCase());
}

function isCssProperty(prop) {
    return knownProps.includes(prop);
}

function parseColonPair(str) {
  const match = str.split(':');
  if (match.length>1) {
    return {
      prefixs: match.slice(0,-1),
      key: match[match.length-1]
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
    // 先读取 atomic.style.css 文件的内容
    let existingContent = '';
    try {
      existingContent = await fs.readFile(rootCssPath, 'utf-8');
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.error('读取 atomic.style.css 文件出错：', err);
        return;
      }
      // 如果文件不存在，初始化为空字符串
      existingContent = '';
    }

    let content = ``;
    let curClassStyle='';
    outer: for (let c of result) {
      if (!existingContent.includes(`.${c}{`)) {
        //判断是否为用户自定义类
        if(configStyle.has(c)){
          curClassStyle=`.${c}${configStyle.get(c)}\n`;
        }else{ 
          let [name, ...values] = c.split('-');
          let prefixs = null;
          let v='';
          const prefixobj = parseColonPair(name);
          if(prefixobj){
            prefixs=prefixobj.prefixs;
            name=prefixobj.key;
          }
          
          if (isCssProperty(camelCaseToDashCase(name)) && values.length>0) {
            // 检查类名是否已经存在
            curClassStyle=`.${c}{${camelCaseToDashCase(name)}:${values.join(' ')}}\n`;
            v=`${camelCaseToDashCase(name)}:${values.join(' ')}`;
          }else if(quickmap.has(name) && values.length>0){
            curClassStyle=`.${c}{${quickmap.get(name)}:${s.join(' ')}}\n`;
            v=`${quickmap.get(name)}:${values.join(' ')}`;
          }else if(quickmap.has(name) && values.length==0){
            curClassStyle=`.${c}{${quickmap.get(name)}}\n`;
            v=`${quickmap.get(name)}`;
          }else continue;

          if(prefixs){//有前缀的处理
            let prefixspart='';
            let pseudopart='';
            let darkpart='';
            let mediapart='@media';
            for(let i=0;i<prefixs.length;i++){
              if(!prefixmap.has(prefixs[i])){//如果前缀不对就跳过这个类处理
                console.error(`前缀写法错误，忽略类名：${c}`);
                continue outer;
              }
              prefixspart+=prefixs[i]+'\\:';
              const prefixValue=prefixmap.get(prefixs[i]);
              if(prefixs[i]=='dark'&&darkMode=='selector'&&!darkpart){//暗黑模式selector处理
                darkpart=`.dark `;
              }else if(prefixValue.includes('@media')){//媒体查询
                mediapart+=mediapart=='@media'?prefixValue.split(' ')[1]:`and${prefixValue.split(' ')[1]}`;
              }else if(prefixValue==prefixs[i]){//伪类
                pseudopart+=`:${prefixValue}`;
              }
            }
            curClassStyle=mediapart!=='@media'?`${mediapart}{\n${darkpart}.${prefixspart}${name+(values.length>0?'-'+values.join('-'):'')}${pseudopart}{${v}}\n}\n`: `${darkpart}.${prefixspart}${name+(values.length>0?'-'+values.join('-'):'')}${pseudopart}{${v}}\n`;
          }
        }

        if(!existingContent.includes(curClassStyle)){//再次判断
          content += curClassStyle;
          existingContent += curClassStyle;//避免重复读取文件，临时加入变量
        }
      }
    }

    // 追加内容到根目录的 atomic.style.css
    if (content) {
      await appendToFile(rootCssPath, content);
    }
  } catch (err) {
    console.error('处理类名时出错：', err);
  }
});
