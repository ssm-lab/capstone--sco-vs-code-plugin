export const SMELL_MAP: Map<string, SmellDetails> = new Map([
  [
    'R1729',
    {
      symbol: 'use-a-generator',
      message:
        'Refactor to use a generator expression instead of a list comprehension inside `any()` or `all()`. This improves memory efficiency by avoiding the creation of an intermediate list.',
    },
  ],
  [
    'R0913',
    {
      symbol: 'too-many-arguments',
      message:
        'Refactor the function to reduce the number of parameters. Functions with too many arguments can become difficult to maintain and understand. Consider breaking it into smaller, more manageable functions.',
    },
  ],
  [
    'R6301',
    {
      symbol: 'no-self-use',
      message:
        "Refactor the method to make it static, as it does not use `self`. Static methods do not require an instance and improve clarity and performance when the method doesn't depend on instance data.",
    },
  ],
  [
    'LLE001',
    {
      symbol: 'long-lambda-expression',
      message:
        'Refactor the lambda expression to improve readability. Long lambda expressions can be confusing; breaking them into named functions can make the code more understandable and maintainable.',
    },
  ],
  [
    'LMC001',
    {
      symbol: 'long-message-chain',
      message:
        'Refactor the message chain to improve readability and performance. Long chains of method calls can be hard to follow and may impact performance. Consider breaking them into smaller steps.',
    },
  ],
  [
    'UVA001',
    {
      symbol: 'unused-variables-and-attributes',
      message:
        'Remove unused variables or attributes to clean up the code. Keeping unused elements in the code increases its complexity without providing any benefit, making it harder to maintain.',
    },
  ],
  [
    'LEC001',
    {
      symbol: 'long-element-chain',
      message:
        'Refactor the long element chain for better performance and clarity. Chains of nested elements are harder to read and can lead to inefficiency, especially when accessing deep levels repeatedly.',
    },
  ],
  [
    'CRC001',
    {
      symbol: 'cached-repeated-calls',
      message:
        'Refactor by caching repeated function calls to improve performance. Repeated calls to the same function can be avoided by storing the result, which saves processing time and enhances performance.',
    },
  ],
  [
    'SCL001',
    {
      symbol: 'string-concat-loop',
      message:
        'Refactor to use list accumulation instead of string concatenation inside a loop. Concatenating strings in a loop is inefficient; list accumulation and joining are faster and use less memory.',
    },
  ],
]);
