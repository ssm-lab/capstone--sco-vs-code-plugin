import { SmellDetails } from '../types';

export const SMELL_MAP: Map<string, SmellDetails> = new Map([
  [
    'R1729', // id: "use-a-generator"
    {
      symbol: 'use-a-generator',
      message:
        'Refactor to use a generator expression instead of a list comprehension inside `any()` or `all()`. This improves memory efficiency by avoiding the creation of an intermediate list.',
      colour: 'rgb(255, 204, 0)', // Yellow
    },
  ],
  [
    'R0913', // id: "too-many-arguments"
    {
      symbol: 'too-many-arguments',
      message:
        'Refactor the function to reduce the number of parameters. Functions with too many arguments can become difficult to maintain and understand. Consider breaking it into smaller, more manageable functions.',
      colour: 'rgb(255, 102, 102)', // Light Red
    },
  ],
  [
    'R6301', // id: "no-self-use"
    {
      symbol: 'no-self-use',
      message:
        "Refactor the method to make it static, as it does not use `self`. Static methods do not require an instance and improve clarity and performance when the method doesn't depend on instance data.",
      colour: 'rgb(204, 255, 255)', // Light Cyan
    },
  ],
  [
    'LLE001', // id: "long-lambda-expression"
    {
      symbol: 'long-lambda-expression',
      message:
        'Refactor the lambda expression to improve readability. Long lambda expressions can be confusing; breaking them into named functions can make the code more understandable and maintainable.',
      colour: 'rgb(153, 102, 255)', // Light Purple
    },
  ],
  [
    'LMC001', // id: "long-message-chain"
    {
      symbol: 'long-message-chain',
      message:
        'Refactor the message chain to improve readability and performance. Long chains of method calls can be hard to follow and may impact performance. Consider breaking them into smaller steps.',
      colour: 'rgb(255, 204, 255)', // Light Pink
    },
  ],
  [
    'UVA001', // id: "unused_variables_and_attributes"
    {
      symbol: 'unused-variables-and-attributes',
      message:
        'Remove unused variables or attributes to clean up the code. Keeping unused elements in the code increases its complexity without providing any benefit, making it harder to maintain.',
      colour: 'rgb(255, 255, 102)', // Light Yellow
    },
  ],
  [
    'LEC001', // id: "long-element-chain"
    {
      symbol: 'long-element-chain',
      message:
        'Refactor the long element chain for better performance and clarity. Chains of nested elements are harder to read and can lead to inefficiency, especially when accessing deep levels repeatedly.',
      colour: 'rgb(204, 204, 255)', // Light Blue
    },
  ],
  [
    'CRC001', // id: "cached-repeated-calls"
    {
      symbol: 'cached-repeated-calls',
      message:
        'Refactor by caching repeated function calls to improve performance. Repeated calls to the same function can be avoided by storing the result, which saves processing time and enhances performance.',
      colour: 'rgb(102, 255, 102)', // Light Green
    },
  ],
  [
    'SCL001', // id: "string-concat-loop"
    {
      symbol: 'string-concat-loop',
      message:
        'Refactor to use list accumulation instead of string concatenation inside a loop. Concatenating strings in a loop is inefficient; list accumulation and joining are faster and use less memory.',
      colour: 'rgb(255, 178, 102)', // Light Orange
    },
  ],
]);
