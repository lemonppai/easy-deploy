'use strict';

const inquirer = require('inquirer');

/**
 * inquirer 做一层薄封装：对外只暴露本项目用到的几种问答，
 * 内部统一处理返回值的形状，业务流程里就不用重复解构。
 */

async function prompt(question) {
  const answers = await inquirer.prompt([question]);
  return answers.result;
}

/** 单选列表 */
async function askSelect({ message, choices, pageSize = 12 }) {
  return prompt({
    type: 'list',
    name: 'result',
    message,
    choices,
    pageSize,
    loop: false,
  });
}

/** 文本输入 */
async function askInput({ message, default: defaultValue, validate }) {
  return prompt({
    type: 'input',
    name: 'result',
    message,
    default: defaultValue,
    validate,
  });
}

/** 密码输入（不回显） */
async function askPassword({ message, validate }) {
  return prompt({
    type: 'password',
    name: 'result',
    message,
    mask: '*',
    validate,
  });
}

/** 是 / 否确认 */
async function askConfirm({ message, default: defaultValue = true }) {
  return Boolean(
    await prompt({
      type: 'confirm',
      name: 'result',
      message,
      default: defaultValue,
    }),
  );
}

/** 多行输入：留空表示结束，返回去掉空行后的命令数组 */
const separator = () => new inquirer.Separator();

module.exports = {
  askSelect,
  askInput,
  askPassword,
  askConfirm,
  separator,
};
