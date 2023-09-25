// Right click on the script name and hit "Run" to execute
const { anyValue } =  require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { MerkleTree } = require("merkletreejs");
const keccak256 = require('keccak256');
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { constants } = require("@openzeppelin/test-helpers");
const { string } = require("hardhat/internal/core/params/argumentTypes");


function generateMerkleTree(arr) {
    let leafNodes = arr.map(addr => keccak256(addr));
    let merkleTree = new MerkleTree(leafNodes, keccak256, {sortPairs: true});
    return merkleTree;
}

function generateMerkleProof(merkle, userAddress) {
    userAddress = keccak256(userAddress)
    let hexProof = merkle.getHexProof(userAddress)
    return hexProof
}


describe("Test-StakeFeePool-Normal", function() {
    // nft contract;
    let nftAddress;
    // fee pool contract;
    let feePoolAddress;
    let feePoolAddress_before;
    let adminAddress;
    let operatorAddress;
    let otherAddress;
    let othAddress;
    let merkleTree;
    const feeprecision = BigInt(10000);
    const ethprecision = 1000000000000000000;
    const maxSupply = [100,100,100];
    const reduceCount = [1,2,4];
    const pubkeys = ["0xa0ad260ee853d0eea82373dc35b24120c2f0c8af43c84c4d8d4a0aa9e640f8d8a84d2d3c441ed9bfe5d83f385526897f", "0xa1ccb300043e71cfe66169281703bef1b9ee80c5797458caf5c428385a99ca97fdb1442febd2137675287bcea5c9a0b2", "0x8d2aac1d013e73525e598faaf02661f7835729abb187bba578e3d7df41dd47899163c641543ae66190f0dae9088975b7", "0x8fee581a3640525a0c3ac064273bf233f7c48daa43f2c89b4d5f225c8da9398bda3feb55ae416072dba91592b1006ba1"]
    const batchkeys = "0xa1ccb300043e71cfe66169281703bef1b9ee80c5797458caf5c428385a99ca97fdb1442febd2137675287bcea5c9a0b28d2aac1d013e73525e598faaf02661f7835729abb187bba578e3d7df41dd47899163c641543ae66190f0dae9088975b7";


async function depolyFeePoolFixtre() {
        [adminAddress, operatorAddress, otherAddress] = await ethers.getSigners();
        const DxPoolStakingFeePool = await ethers.getContractFactory("DxPoolStakingFeePool");
        feePoolAddress_before = await DxPoolStakingFeePool.deploy();
}

/*
    feepool和token合约共同部署
*/        
async function deployFeePoolAndTokenFixture() {
    [adminAddress, operatorAddress, otherAddress] = await ethers.getSigners();
    // 设置feePool合约
    const DxPoolStakingFeePool = await ethers.getContractFactory("DxPoolStakingFeePool");
    feePoolAddress = await DxPoolStakingFeePool.deploy();
    await feePoolAddress.initialize(operatorAddress.address, adminAddress.address);

    // 获取merkkleRoot
    level1 = Array.of(adminAddress.address, operatorAddress.address, otherAddress.address)
    level2 = Array.of(adminAddress.address, operatorAddress.address)
    level3 = Array.of(adminAddress.address)
    merkleTree = Array.of(generateMerkleTree(level1), generateMerkleTree(level2), generateMerkleTree(level3))
    level1Root = "0x" + merkleTree[0].getRoot().toString('hex')
    level2Root = "0x" + merkleTree[1].getRoot().toString('hex')
    level3Root = "0x" + merkleTree[2].getRoot().toString("hex")
    merkle = [level1Root, level2Root, level3Root]
    // 设置token合约
    const Token = await ethers.getContractFactory("MyToken")
    nftAddress = await Token.deploy()
    await nftAddress.setRootHash(merkle)
    await nftAddress.setMaxSupply(maxSupply)
    // 相互设置地址
    await nftAddress.setDxpoolStakingFeePool(feePoolAddress)
    await feePoolAddress.setDxPoolOfficial(nftAddress)
    await feePoolAddress.SetNftLevelValidatorReduceCount(reduceCount);
}

/* test initialize */
it("test-> initalize only can be called one time", async function(){
    await loadFixture (deployFeePoolAndTokenFixture);
    await expect(feePoolAddress.initialize(operatorAddress.address, adminAddress.address)).to.be.revertedWith("Initializable: contract is already initialized");
})
it ("test-> initialize admin not address 0", async function(){
    await loadFixture (depolyFeePoolFixtre);
    await expect(feePoolAddress.initialize(operatorAddress, constants.ZERO_ADDRESS)).to.be.reverted;
})

it ("test-> initialize operator not address 0", async function() {
    await loadFixture (depolyFeePoolFixtre);
    await expect(feePoolAddress.initialize(adminAddress, constants.ZERO_ADDRESS)).to.be.reverted;
})

/* test enterPool */
it("test-> validator enterPool operator only", async function() {
    await loadFixture(deployFeePoolAndTokenFixture);
    await expect(feePoolAddress.connect(otherAddress).enterPool(pubkeys[0], otherAddress)).to.be.revertedWith("Only Dxpool staking operator allowed");
})

it ("test-> validator enterPool success", async function() {
    await loadFixture(deployFeePoolAndTokenFixture);
    await feePoolAddress.connect(operatorAddress).enterPool(pubkeys[0], operatorAddress)
    let userInfo = await feePoolAddress.getUserInfo(operatorAddress);
    expect(userInfo[0]).to.equal(1);
})

// 利用anyValue，emit检查的时候可以忽略取值, block timestamp
it("test-> validator enterPool success event", async function() {
    await loadFixture(deployFeePoolAndTokenFixture);
    await expect(feePoolAddress.connect(operatorAddress).enterPool(pubkeys[0], otherAddress)).to.emit(feePoolAddress, "ValidatorEntered").withArgs(pubkeys[0], otherAddress.address, anyValue);  
})

it("test-> validator enterPool already exists", async function() {
    await loadFixture (deployFeePoolAndTokenFixture);
    await feePoolAddress.connect(operatorAddress).enterPool(pubkeys[0], operatorAddress);
    await expect(feePoolAddress.connect(operatorAddress).enterPool(pubkeys[0], otherAddress)).to.be.revertedWith("Validator already in pool");
})

it("test-> validator enterPool with address 0", async function() {
    await loadFixture (deployFeePoolAndTokenFixture);
    await expect(feePoolAddress.connect(operatorAddress).enterPool(pubkeys[0], constants.ZERO_ADDRESS)).to.be.revertedWith("depositorAddress not be empty")
})

/* test leavePool */
it("test-> leave pool operator only", async function() {
    await loadFixture(deployFeePoolAndTokenFixture);
    await expect(feePoolAddress.connect(otherAddress).leavePool(pubkeys[0])).to.be.revertedWith("Only Dxpool staking operator allowed");
})

it("test-> leave pool validator not in pool", async function(){
    await loadFixture(deployFeePoolAndTokenFixture);
    await expect(feePoolAddress.connect(operatorAddress).leavePool(pubkeys[0])).to.be.revertedWith("Validator not in pool");
})

it ("test-> validator leave pool success", async function() {
    await loadFixture(deployFeePoolAndTokenFixture);
    await feePoolAddress.connect(operatorAddress).enterPool(pubkeys[0], operatorAddress)
    let userInfo = await feePoolAddress.getUserInfo(operatorAddress);
    expect(userInfo[0]).to.equal(1);

    await feePoolAddress.connect(operatorAddress).leavePool(pubkeys[0]);
    let userInfo_after = await feePoolAddress.getUserInfo(operatorAddress);
    expect(userInfo_after[0]).to.equal(0);
})

it ("test-> validator leave pool success event", async function() {
    await loadFixture(deployFeePoolAndTokenFixture);
    await feePoolAddress.connect(operatorAddress).enterPool(pubkeys[0], operatorAddress)
    let userInfo = await feePoolAddress.getUserInfo(operatorAddress);
    expect(userInfo[0]).to.equal(1);
    await expect(feePoolAddress.connect(operatorAddress).leavePool(pubkeys[0])).to.emit(feePoolAddress, "ValidatorLeft").withArgs(pubkeys[0], operatorAddress.address, anyValue);
})

/* test batchEnterPool */
it ("test-> batchEnter data error", async function(){
    await loadFixture (deployFeePoolAndTokenFixture);
    let wrongdata = "0xaaaa";
    let depositAddress = [];
    await expect(feePoolAddress.connect(operatorAddress).batchEnterPool(wrongdata, depositAddress)).to.be.revertedWith("Invalid depositorAddresses length");
})

it ("test-> batchEnter success", async function() {
    await loadFixture (deployFeePoolAndTokenFixture);
    let depositAddress = ["0xdE183f79F8687399AdBDCA64A6A6A080f8a6D8D4", "0xdE183f79F8687399AdBDCA64A6A6A080f8a6D8D4"];
    await feePoolAddress.connect(operatorAddress).batchEnterPool(batchkeys, depositAddress);
    let returnValue = await feePoolAddress.getUserInfo("0xdE183f79F8687399AdBDCA64A6A6A080f8a6D8D4");
    expect(returnValue[0]).to.equal(2);
})

it("test-> batchEnter success event", async function() {
    await loadFixture (deployFeePoolAndTokenFixture);
    let depositAddress = ["0xdE183f79F8687399AdBDCA64A6A6A080f8a6D8D4"];
    await expect(feePoolAddress.connect(operatorAddress).batchEnterPool(pubkeys[0], depositAddress)).to.emit(feePoolAddress, "ValidatorEntered").withArgs(pubkeys[0], "0xdE183f79F8687399AdBDCA64A6A6A080f8a6D8D4", anyValue);
})

/* test batchLeavePool */
it("test-> batchLeave data error", async function(){
    await loadFixture (deployFeePoolAndTokenFixture);
    await expect(feePoolAddress.connect(operatorAddress).batchLeavePool(pubkeys[0])).to.be.revertedWith("Validator not in pool");
})

it ("test-> batchLeave success", async function(){
    await loadFixture (deployFeePoolAndTokenFixture);
    let depositAddress = ["0xdE183f79F8687399AdBDCA64A6A6A080f8a6D8D4"];
    await feePoolAddress.connect(operatorAddress).batchEnterPool(pubkeys[0], depositAddress);
    let returnValue = await feePoolAddress.getUserInfo("0xdE183f79F8687399AdBDCA64A6A6A080f8a6D8D4");
    expect(returnValue[0]).to.equal(1);

    await feePoolAddress.connect(operatorAddress).batchLeavePool(pubkeys[0])
    let afterValue = await feePoolAddress.getUserInfo("0xdE183f79F8687399AdBDCA64A6A6A080f8a6D8D4");
    expect(afterValue[0]).to.equal(0);
})

it ("test-> batchLeave success event", async function(){
    await loadFixture (deployFeePoolAndTokenFixture);
    let depositAddress = ["0xdE183f79F8687399AdBDCA64A6A6A080f8a6D8D4"];
    await feePoolAddress.connect(operatorAddress).batchEnterPool(pubkeys[0], depositAddress);
    await expect(feePoolAddress.connect(operatorAddress).batchLeavePool(pubkeys[0])).to.emit(feePoolAddress, "ValidatorLeft").withArgs(pubkeys[0], "0xdE183f79F8687399AdBDCA64A6A6A080f8a6D8D4" ,anyValue);
})


/* test changeOperator */
it ("test-> change operator success", async function() {
    await loadFixture (deployFeePoolAndTokenFixture);
    await feePoolAddress.connect(adminAddress).changeOperator(otherAddress);
    // 如果通过新的能够enterPool就视为成功
    await feePoolAddress.connect(otherAddress).enterPool(pubkeys[0], operatorAddress);
    // 判断是否validator存在
    let userInfo = await feePoolAddress.getUserInfo(operatorAddress);
    expect(userInfo[0]).to.equal(1);
})

it ("test-> change operator success event", async function() {
    await loadFixture (deployFeePoolAndTokenFixture);
    await expect(feePoolAddress.connect(adminAddress).changeOperator(otherAddress)).to.emit(feePoolAddress, "OperatorChanged").withArgs(otherAddress.address);
})

it ("test-> change operator admin only", async function() {
    await loadFixture (deployFeePoolAndTokenFixture);
    await expect(feePoolAddress.connect(operatorAddress).changeOperator(otherAddress)).to.be.revertedWith("Only Dxpool staking admin allowed")
})

it ("test-> change operator zero address", async function() {
    await loadFixture (deployFeePoolAndTokenFixture);
    await expect(feePoolAddress.connect(adminAddress).changeOperator(constants.ZERO_ADDRESS)).to.be.reverted;
})

/* test transferValidatorByAdmin */
it ("test-> transferValidatorByAdmin admin only", async function() {
    await loadFixture (deployFeePoolAndTokenFixture);
    // opeartor validator enter
    await feePoolAddress.connect(operatorAddress).enterPool(pubkeys[0], operatorAddress);
    // 判断是否validator存在
    let userInfo = await feePoolAddress.getUserInfo(operatorAddress);
    expect(userInfo[0]).to.equal(1);
    let address = [operatorAddress.address];
    await expect(feePoolAddress.connect(operatorAddress).transferValidatorByAdmin(pubkeys[0], address)).to.be.revertedWith("Only Dxpool staking admin allowed");
})

it ("test-> transferValidator address zero", async function() {
    await loadFixture (deployFeePoolAndTokenFixture);
    // opeartor validator enter
    await feePoolAddress.connect(operatorAddress).enterPool(pubkeys[0], operatorAddress);
    let userInfo = await feePoolAddress.getUserInfo(operatorAddress);
    expect(userInfo[0]).to.equal(1);
    let address = [constants.ZERO_ADDRESS];
    await expect(feePoolAddress.connect(adminAddress).transferValidatorByAdmin(pubkeys[0], address)).to.be.revertedWith("to address must be set to nonzero");
})

it ("test-> transferValidator same as before", async function() {
    await loadFixture (deployFeePoolAndTokenFixture);
    // opeartor validator enter
    await feePoolAddress.connect(operatorAddress).enterPool(pubkeys[0], operatorAddress);
    let userInfo = await feePoolAddress.getUserInfo(operatorAddress);
    expect(userInfo[0]).to.equal(1);
    let address = [operatorAddress.address];
    await expect(feePoolAddress.connect(adminAddress).transferValidatorByAdmin(pubkeys[0], address)).to.be.revertedWith("cannot transfer validator owner to oneself");
})

it("test-> transferValidator success", async function() {
    await loadFixture (deployFeePoolAndTokenFixture);
    await feePoolAddress.connect(operatorAddress).enterPool(pubkeys[0], operatorAddress);
    let userInfo = await feePoolAddress.getUserInfo(operatorAddress);
    expect(userInfo[0]).to.equal(1);
    let address = [adminAddress.address];
    await feePoolAddress.connect(adminAddress).transferValidatorByAdmin(pubkeys[0], address);
    let adminUserInfo_after = await feePoolAddress.getUserInfo(adminAddress);
    expect(adminUserInfo_after[0]).to.equal(1);
    let operatorUserInfo_after = await feePoolAddress.getUserInfo(operatorAddress);
    expect(operatorUserInfo_after[0]).to.equal(0);
})

it("test-> transferValidator success event",async function(){
    await loadFixture (deployFeePoolAndTokenFixture);
    await feePoolAddress.connect(operatorAddress).enterPool(pubkeys[0], operatorAddress);
    let userInfo = await feePoolAddress.getUserInfo(operatorAddress);
    expect(userInfo[0]).to.equal(1);
    let address = [adminAddress.address];
    await expect(feePoolAddress.connect(adminAddress).transferValidatorByAdmin(pubkeys[0], address)).to.emit(feePoolAddress, "ValidatorTransferred").withArgs(pubkeys[0], operatorAddress.address, adminAddress.address, anyValue);
})


/* test emergencyWithdraw */
it ("test-> emergencyWithdraw admin only", async function(){
    await loadFixture (deployFeePoolAndTokenFixture);
    await feePoolAddress.connect(operatorAddress).enterPool(pubkeys[0], operatorAddress);
    let deposit = [operatorAddress.address];
    let withdraw = [operatorAddress.address];
    await expect(feePoolAddress.connect(operatorAddress).emergencyWithdraw(deposit, withdraw, 0)).to.be.revertedWith("Only Dxpool staking admin allowed");
})

it("test-> emergencyWithdraw length incorrect", async function(){
    await loadFixture (deployFeePoolAndTokenFixture);
    await feePoolAddress.connect(operatorAddress).enterPool(pubkeys[0], operatorAddress);
    let deposit = [operatorAddress.address];
    let withdraw = [];
    await expect(feePoolAddress.connect(adminAddress).emergencyWithdraw(deposit, withdraw, 0)).to.be.revertedWith("withdrawAddress length incorrect");
})

it("test-> emergencyWithdraw success", async function(){
    await loadFixture(deployFeePoolAndTokenFixture);
    await feePoolAddress.connect(operatorAddress).enterPool(pubkeys[0], operatorAddress);
    await feePoolAddress.connect(operatorAddress).enterPool(pubkeys[1], adminAddress);
    const value = ethers.parseEther("0.01");
    const tx = {
        to: feePoolAddress.getAddress(),
        value: value,
    };
    await operatorAddress.sendTransaction(tx);
    let actualValue = 0.01 * ethprecision;
    let feeRate = await feePoolAddress.stakeCommissionFeeRate();
    let rate = BigInt(10000) - BigInt(feeRate);
    let expectValue = (BigInt(actualValue) * BigInt(rate)) / (BigInt(2) * BigInt(feeprecision));
    let deposit = [operatorAddress.address, adminAddress.address];
    let withdraw = [operatorAddress.address, adminAddress.address];
    await feePoolAddress.connect(adminAddress).emergencyWithdraw(deposit, withdraw, 0);

    let operatorReturnValue = await feePoolAddress.getUserRewardInfo(operatorAddress);
    let adminReturnValue = await feePoolAddress.getUserRewardInfo(adminAddress);
    expect(operatorReturnValue[0]).to.equal(expectValue);
    expect(operatorReturnValue[1]).to.equal(0);
    expect(operatorReturnValue[2]).to.equal(expectValue);

    expect(adminReturnValue[0]).to.equal(expectValue);
    expect(adminReturnValue[1]).to.equal(0);
    expect(adminReturnValue[2]).to.equal(expectValue);
})

it ("test-> emergencyWithdraw one withdraw address", async function() {
    await loadFixture(deployFeePoolAndTokenFixture);
    await feePoolAddress.connect(operatorAddress).enterPool(pubkeys[0], operatorAddress);
    await feePoolAddress.connect(operatorAddress).enterPool(pubkeys[1], adminAddress);
    const value = ethers.parseEther("0.01");
    const tx = {
        to: feePoolAddress.getAddress(),
        value: value,
    };
    await operatorAddress.sendTransaction(tx);
    let actualValue = 0.01 * ethprecision;
    let feeRate = await feePoolAddress.stakeCommissionFeeRate();
    let rate = BigInt(10000) - BigInt(feeRate);
    let expectValue = (BigInt(actualValue) * BigInt(rate)) / (BigInt(2) * BigInt(feeprecision));
    let deposit = [operatorAddress.address, adminAddress.address];
    let withdraw = [operatorAddress.address];
    await feePoolAddress.connect(adminAddress).emergencyWithdraw(deposit, withdraw, 0);

    let operatorReturnValue = await feePoolAddress.getUserRewardInfo(operatorAddress);
    let adminReturnValue = await feePoolAddress.getUserRewardInfo(adminAddress);
    expect(operatorReturnValue[0]).to.equal(expectValue);
    expect(operatorReturnValue[1]).to.equal(0);
    expect(operatorReturnValue[2]).to.equal(expectValue);

    expect(adminReturnValue[0]).to.equal(expectValue);
    expect(adminReturnValue[1]).to.equal(0);
    expect(adminReturnValue[2]).to.equal(expectValue);
})

/* test poolWithdraw */
it ("test-> closePoolWithdrawl admin only", async function() {
    await loadFixture (deployFeePoolAndTokenFixture);
    await expect((feePoolAddress.connect(operatorAddress).closePoolForWithdrawal())).to.be.revertedWith("Only Dxpool staking admin allowed");
})
    
it ("test-> closePoolWithdrawl success", async function() {
    await loadFixture (deployFeePoolAndTokenFixture);
    await feePoolAddress.connect(adminAddress).closePoolForWithdrawal();
    expect(await feePoolAddress.isOpenForWithdrawal()).to.equal(false);
})

it ("test-> openPoolWithdrawl admin only", async function() {
    await loadFixture (deployFeePoolAndTokenFixture);
    await expect((feePoolAddress.connect(operatorAddress).openPoolForWithdrawal())).to.be.revertedWith("Only Dxpool staking admin allowed");
})

it ("test-> openPoolWithdrawl is open yet fail", async function() {
    await loadFixture (deployFeePoolAndTokenFixture);
    await expect(feePoolAddress.connect(adminAddress).openPoolForWithdrawal()).to.be.revertedWith("Pool is already open for withdrawal");
})


/* test saveToColdWallet */ 
it ("test-> saveToColdWallet not enough balance", async function(){
    await loadFixture (deployFeePoolAndTokenFixture);
    await expect(feePoolAddress.saveToColdWallet(operatorAddress, 1)).to.be.revertedWith("Not enough balance");
})

it ("test-> saveToColdWallet success", async function() {
    await loadFixture (deployFeePoolAndTokenFixture);
    // 发送 0.01 eth
    const value = ethers.parseEther("0.01");
    const tx = {
        to: feePoolAddress.getAddress(),
        value: value,
    };
    await operatorAddress.sendTransaction(tx);
    await feePoolAddress.connect(adminAddress).saveToColdWallet(operatorAddress, value);
    let coldWallet = await feePoolAddress.totalTransferredToColdWallet();
    expect(coldWallet).to.equal(value);
})

/* test setCommssionFeeRate */
it ("test-> get commissionFeeRate", async function() {
    await loadFixture (deployFeePoolAndTokenFixture);
    let feeRate = await feePoolAddress.stakeCommissionFeeRate();
    expect(feeRate).to.equal(2000);
})

it ("test-> set commissionFee admin only", async function() {
    await loadFixture (deployFeePoolAndTokenFixture);
    await expect(feePoolAddress.connect(operatorAddress).setStakeCommissionFeeRate(3000)).to.be.revertedWith("Only Dxpool staking admin allowed");
})

it ("test-> set commissionFee success", async function() {
    await loadFixture (deployFeePoolAndTokenFixture);
    let rate = 3000;
    await feePoolAddress.connect(adminAddress).setStakeCommissionFeeRate(rate);
    let newFeeRate = await feePoolAddress.stakeCommissionFeeRate();
    expect(newFeeRate).to.equal(rate);
})

it ("test-> set commissionFee success event", async function() {
    await loadFixture (deployFeePoolAndTokenFixture);
    let rate = 3000;
    await expect(feePoolAddress.connect(adminAddress).setStakeCommissionFeeRate(rate)).to.emit(feePoolAddress, "CommissionFeeRateChanged").withArgs(rate);  
})

/* test setNftAddress */
it ("test-> setNftAddress zero", async function() {
    await loadFixture (deployFeePoolAndTokenFixture);
    await expect(feePoolAddress.connect(adminAddress).setDxPoolOfficial(constants.ZERO_ADDRESS)).to.be.revertedWith("Nft address can not be empty");
})

it ("test-> setNftAddress admin only", async function() {
    await loadFixture (deployFeePoolAndTokenFixture);
    await expect(feePoolAddress.connect(operatorAddress).setDxPoolOfficial(operatorAddress)).to.be.revertedWith("Only Dxpool staking admin allowed");
})

it ("test-> NftTransfer only nftAddress", async function() {
    await expect(feePoolAddress.connect(adminAddress).onNftTransfer(adminAddress, operatorAddress)).to.be.revertedWith("Only Dxpool staking nftAddress allowed");
})

it ("test-> get user nft info with adddress 0", async function() {
    await loadFixture (deployFeePoolAndTokenFixture);
    await expect(feePoolAddress.getUserNftInfo(constants.ZERO_ADDRESS)).to.be.revertedWith("depositorAddress not be empty")
})

it ("test-> nft transfer wrong caller", async function() {
    await loadFixture (deployFeePoolAndTokenFixture);
    await feePoolAddress.connect(operatorAddress).enterPool(pubkeys[0], operatorAddress);
    await feePoolAddress.connect(operatorAddress).enterPool(pubkeys[1], adminAddress);
    let a = await feePoolAddress.justifyValidatorInPool(pubkeys[0]);
    let b = await feePoolAddress.justifyValidatorInPool(pubkeys[1]);
    expect(a[0]).to.equal(true);
    expect(b[0]).to.equal(true);

    let proof = generateMerkleProof(merkleTree[1], operatorAddress.address)
    await nftAddress.connect(operatorAddress).whitelistclaim(proof, 2);
    // 判断是否claim nft是否成功
    let operatorNftLevel = await nftAddress.getHeighestLevelByOwner(operatorAddress);
    expect(operatorNftLevel).to.equal(2);
    let adminNftLevel = await nftAddress.getHeighestLevelByOwner(adminAddress);
    expect(adminNftLevel).to.equal(0);
    // 此时调用nft transfer 方法，将operator nft -> admin nft
    await expect(nftAddress.transferFrom(operatorAddress, adminAddress, 0)).to.be.revertedWith("ERC721: caller is not token owner or approved")
})

})