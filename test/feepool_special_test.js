// Right click on the script name and hit "Run" to execute
const { anyValue } =  require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { MerkleTree } = require("merkletreejs");
const keccak256 = require('keccak256');
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { constants } = require("@openzeppelin/test-helpers");
const { string } = require("hardhat/internal/core/params/argumentTypes");

function generateLevelProof(merkle, level, userAddress) {
    let hexProof
    if (level > 0){
        userAddress = keccak256(userAddress);
        hexProof  = merkle[level-1].getHexProof(userAddress);
    }
    return hexProof
}

function generateMerkleTree(arr) {
    let leafNodes = arr.map(addr => keccak256(addr));
    let merkleTree = new MerkleTree(leafNodes, keccak256, {sortPairs: true});
    return merkleTree;
}

function generateRandomPublickeys(n) {
    let publicKeys = [];
    for (let i= 0 ; i < n ; i ++) {
        wallet = ethers.Wallet.createRandom()
        let publicKey = wallet.publicKey
        publicKeys.push(publicKey)
    }
    return publicKeys
}

function generateRandomBatchPublickeys(n) {
    let publicKeys
    for (let i= 0 ; i < n ; i ++) {
        wallet = ethers.Wallet.createRandom()
        let publicKey = wallet.publicKey.slice(2)
        publicKeys += publicKey
    }
    if (publicKeys != "") {
        publicKeys = "0x" + publicKeys
    }
    return publicKeys
}

function sendEth(from, to, value) {
    const valueEth = ethers.parseEther(value.toString());
    const tx = {
        to: to,
        value: valueEth,
    };
    from.sendTransaction(tx);
}

function generateMerkleProof(merkle, userAddress) {
    userAddress = keccak256(userAddress)
    let hexProof = merkle.getHexProof(userAddress)
    return hexProof
}

describe("Test-StakeFeePool-Special", function() {
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

    /*
        feepool和token合约共同部署
    */
    async function deployFeePoolAndTokenFixture() {
        // 获得测试用户信息
        [adminAddress, operatorAddress, otherAddress] = await ethers.getSigners();
        // 设置feePool合约
        const DxPoolStakingFeePool = await ethers.getContractFactory("DxPoolStakingFeePool");
        feePoolAddress = await DxPoolStakingFeePool.deploy();
        await feePoolAddress.initialize(operatorAddress.address, adminAddress.address);

        // 获取merkleRoot
        level1 = Array.of(adminAddress.address, operatorAddress.address, otherAddress.address)
        level2 = Array.of(adminAddress.address, operatorAddress.address)
        level3 = Array.of(adminAddress.address)
        merkleTree = Array.of(generateMerkleTree(level1), generateMerkleTree(level2), generateMerkleTree(level3))
        let level1Root = "0x" + merkleTree[0].getRoot().toString('hex')
        let level2Root = "0x" + merkleTree[1].getRoot().toString('hex')
        let level3Root = "0x" + merkleTree[2].getRoot().toString("hex")
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

    it ("test-> validator enter, check reward", async function() {
        // 1. enterPool validator
        await loadFixture (deployFeePoolAndTokenFixture)
        await feePoolAddress.connect(operatorAddress).enterPool(pubkeys[0], operatorAddress)
        expect((await feePoolAddress.getTotalValidatorsCount())).to.equal(1)

        // 2. send eth
        const value = ethers.parseEther("0.01")
        const tx = {
            to: feePoolAddress.getAddress(),
            value: value,
        }
        await operatorAddress.sendTransaction(tx)
        // 3. 计算收益
        let actualValue = 0.01 * ethprecision
        let feeRate = await feePoolAddress.stakeCommissionFeeRate()
        let rate = (BigInt(10000) - BigInt(feeRate))
        let expectValue = (BigInt(actualValue) * BigInt(rate)) / BigInt(feeprecision)
        let feeExpectValue = (BigInt(actualValue) * BigInt(feeRate)) / BigInt(feeprecision)
        let returnValue = await feePoolAddress.getUserRewardInfo(operatorAddress)
        expect(returnValue[0]).to.equal(expectValue)
        expect(returnValue[1]).to.equal(expectValue)
        expect(returnValue[2]).to.equal(0)
        // CommissionFee
        let commissionFeeInfo = await feePoolAddress.getStakeCommissionFeeInfo()
        expect(commissionFeeInfo[0]).to.equal(feeExpectValue)
        expect(commissionFeeInfo[1]).to.equal(feeExpectValue)
        expect(commissionFeeInfo[2]).to.equal(0)
    })

    it ("test-> validator enter, claim level-1 nft , check reward", async function() {
        await loadFixture (deployFeePoolAndTokenFixture);
        // opeartor validator enter
        let publicKeys = generateRandomPublickeys(1);
        await feePoolAddress.connect(operatorAddress).enterPool(publicKeys[0], operatorAddress);
        let userInfo = await feePoolAddress.getUserInfo(operatorAddress);
        expect(userInfo[0]).to.equal(1);
        // operator claim level 1 nft
        proof = generateLevelProof(merkleTree, 1, operatorAddress.address)
        // proof = generateMerkleProof(merkleTree[0], operatorAddress.address)
        await nftAddress.connect(operatorAddress).whitelistclaim(proof, 1);
        // 判断nft claim是否成功
        let nftLevel = await nftAddress.getHeighestLevelByOwner(operatorAddress);
        expect(nftLevel).to.equal(1);
        // 此时发送 0.01 eth
        let value = 0.01;
        sendEth(operatorAddress, feePoolAddress.getAddress(), value)
        // 计算应该获得的收益
        let actualValue = value * ethprecision;
        let feeRate = await feePoolAddress.stakeCommissionFeeRate();
        let rate = BigInt(10000) - BigInt(feeRate);
        let expectValue = (BigInt(actualValue) * BigInt(rate)) / BigInt(feeprecision);
        let returnValue = await feePoolAddress.getUserRewardInfo(operatorAddress);
        expect(returnValue[0]).to.equal(expectValue);
        expect(returnValue[1]).to.equal(expectValue);
        expect(returnValue[2]).to.equal(0);

        // 计算nft应该获得的收益
        let expectNftValue = BigInt(feeRate) * BigInt(actualValue) / BigInt(feeprecision);
        let actualNftValue = await feePoolAddress.getUserNftInfo(operatorAddress);
        expect(actualNftValue[0]).to.equal(expectNftValue);
        expect(actualNftValue[1]).to.equal(0);
    })

    it ("test-> validator enter, claim level-2 nft , check reward", async function() {
        await loadFixture (deployFeePoolAndTokenFixture);
        // opeartor validator enter
        let publicKeys = generateRandomPublickeys(2)
        await feePoolAddress.connect(operatorAddress).enterPool(publicKeys[0], operatorAddress);
        await feePoolAddress.connect(operatorAddress).enterPool(publicKeys[1], operatorAddress);

        let userInfo = await feePoolAddress.getUserInfo(operatorAddress);
        expect(userInfo[0]).to.equal(2);
        // operator claim level 2 nft
        proof = generateLevelProof(merkleTree, 2, operatorAddress.address)
        await nftAddress.connect(operatorAddress).whitelistclaim(proof, 2);
        // 判断nft claim是否成功
        let nftLevel = await nftAddress.getHeighestLevelByOwner(operatorAddress);
        expect(nftLevel).to.equal(2);
        // 此时发送 0.01 eth
        let value = 0.01
        sendEth(operatorAddress, feePoolAddress.getAddress(), value)

        // 计算应该获得的收益
        let actualValue = value * ethprecision;
        let feeRate = await feePoolAddress.stakeCommissionFeeRate();
        let rate = BigInt(10000) - BigInt(feeRate);
        let expectValue = (BigInt(actualValue) * BigInt(rate)) / BigInt(feeprecision);
        let returnValue = await feePoolAddress.getUserRewardInfo(operatorAddress);
        expect(returnValue[0]).to.equal(expectValue);
        expect(returnValue[1]).to.equal(expectValue);
        expect(returnValue[2]).to.equal(0);

        // 计算nft应该获得的收益
        let expectNftValue = BigInt(feeRate) * BigInt(actualValue) / BigInt(feeprecision);
        let actualNftValue = await feePoolAddress.getUserNftInfo(operatorAddress);
        expect(actualNftValue[0]).to.equal(expectNftValue);
        expect(actualNftValue[1]).to.equal(0);
    })


    it ("test-> validator enter, claim level-3 nft , check reward", async function() {
        await loadFixture (deployFeePoolAndTokenFixture);
        // opeartor validator enter
        let publicKeys = generateRandomPublickeys(4)
        await feePoolAddress.connect(operatorAddress).enterPool(publicKeys[0], adminAddress)
        await feePoolAddress.connect(operatorAddress).enterPool(publicKeys[1], adminAddress)
        await feePoolAddress.connect(operatorAddress).enterPool(publicKeys[2], adminAddress)
        await feePoolAddress.connect(operatorAddress).enterPool(publicKeys[3], adminAddress)
        let userInfo = await feePoolAddress.getUserInfo(adminAddress);
        expect(userInfo[0]).to.equal(4);
        // admin claim level 3 nft
        proof = generateLevelProof(merkleTree, 3, adminAddress.address)
        // proof = generateMerkleProof(merkleTree[0], operatorAddress.address)
        await nftAddress.connect(adminAddress).whitelistclaim(proof, 3);
        // 判断nft claim是否成功
        let nftLevel = await nftAddress.getHeighestLevelByOwner(adminAddress);
        expect(nftLevel).to.equal(3);
        // 此时发送 0.01 eth
        let value = 0.01
        sendEth(operatorAddress, feePoolAddress.getAddress(), value)

        // 计算应该获得的收益
        let actualValue = value * ethprecision;
        let feeRate = await feePoolAddress.stakeCommissionFeeRate();
        let rate = BigInt(10000) - BigInt(feeRate);
        let expectValue = (BigInt(actualValue) * BigInt(rate)) / BigInt(feeprecision);
        let returnValue = await feePoolAddress.getUserRewardInfo(adminAddress);
        expect(returnValue[0]).to.equal(expectValue);
        expect(returnValue[1]).to.equal(expectValue);
        expect(returnValue[2]).to.equal(0);

        // 计算nft应该获得的收益
        let expectNftValue = BigInt(feeRate) * BigInt(actualValue) / BigInt(feeprecision);
        let actualNftValue = await feePoolAddress.getUserNftInfo(adminAddress);
        expect(actualNftValue[0]).to.equal(expectNftValue);
        expect(actualNftValue[1]).to.equal(0);
    })


    it ("test-> claim fee admin only", async function(){
        await loadFixture (deployFeePoolAndTokenFixture);
        // opeartor validator enter
        await feePoolAddress.connect(operatorAddress).enterPool(pubkeys[0], operatorAddress);
        // 判断是否validator存在
        let userInfo = await feePoolAddress.getUserInfo(operatorAddress);
        expect(userInfo[0]).to.equal(1);
        // 此时发送 0.01 eth
        let value = 0.01
        sendEth(operatorAddress, feePoolAddress.getAddress(), value)
        await expect(feePoolAddress.connect(operatorAddress).claimStakeCommissionFee(operatorAddress, 1000)).to.be.revertedWith("Only Dxpool staking admin allowed");
    })

    it ("test-> claim fee success event", async function(){
        await loadFixture (deployFeePoolAndTokenFixture);
        // opeartor validator enter
        await feePoolAddress.connect(operatorAddress).enterPool(pubkeys[0], operatorAddress);
        // 判断是否validator存在
        let userInfo = await feePoolAddress.getUserInfo(operatorAddress);
        expect(userInfo[0]).to.equal(1);
        // 此时发送 0.01 eth
        let value = 0.01
        sendEth(operatorAddress, feePoolAddress.getAddress(), value)
        let claimFeeReward = 1000;
        await expect(feePoolAddress.connect(adminAddress).claimStakeCommissionFee(operatorAddress, claimFeeReward)).to.emit(feePoolAddress, "CommissionClaimed").withArgs(operatorAddress.address, claimFeeReward);
    })

    it ("test-> claim fee all (amount = 0)", async function(){
        await loadFixture (deployFeePoolAndTokenFixture);
        await feePoolAddress.connect(operatorAddress).enterPool(pubkeys[0], operatorAddress);
        let operatorUserInfo = await feePoolAddress.getUserInfo(operatorAddress);
        expect(operatorUserInfo[0]).to.equal(1);
        let value = 0.01
        sendEth(operatorAddress, feePoolAddress.getAddress(), value)
        let feeRate = await feePoolAddress.stakeCommissionFeeRate();
        let actualValue = value * ethprecision;
        let actualStakeFee = BigInt(actualValue) * BigInt(feeRate) / (BigInt(feeprecision));
        let feeInfo = await feePoolAddress.getStakeCommissionFeeInfo();
        expect(feeInfo[0]).to.equal(actualStakeFee);
        expect(feeInfo[1]).to.equal(actualStakeFee);
        expect(feeInfo[2]).to.equal(0);

        await feePoolAddress.connect(adminAddress).claimStakeCommissionFee(adminAddress, 0);
        let feeInfo_after = await feePoolAddress.getStakeCommissionFeeInfo();
        expect(feeInfo_after[0]).to.equal(actualStakeFee);
        expect(feeInfo_after[1]).to.equal(0);
        expect(feeInfo_after[2]).to.equal(actualStakeFee);
    })

})