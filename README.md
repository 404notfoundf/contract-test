# contract-test
### 如何使用
```
npm install
npx hardhat compile
npx hardhat test

如果需要指定测试文件
npx hardhat test test/xxx.js
```

### 测试覆盖率
npx hardhat coverage --testfiles test/*.js
可以生成对应的覆盖率文件