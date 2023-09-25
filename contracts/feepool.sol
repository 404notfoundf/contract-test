// SPDX-License-Identifier: MIT

pragma solidity ^0.8.10;

import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";


interface IDxpoolStakingFeePool {
    event ValidatorEntered(bytes validatorPubkey, address depositorAddress, uint256 ts);
    event ValidatorLeft(bytes validatorPubkey, address depositorAddress, uint256 ts);
    event ValidatorRewardClaimed(address depositorAddress, address withdrawAddress, uint256 rewardAmount);
    event ValidatorTransferred(bytes indexed validatorPubkey, address indexed from, address indexed to, uint256 ts);
    event OperatorChanged(address newOperator);
    event CommissionFeeRateChanged(uint256 newFeeRate);
    event CommissionClaimed(address withdrawAddress, uint256 collectedAmount);

    ////
    event ValidatorNftRewardClaimed(address depositorAddress, address withdrawAddress, uint256 rewardAmount);
    event NftTransfererred(address indexed from, address indexed to, uint256 ts);
    event NftClaimed(address indexed to, uint256 ts);

    // Only operation can do those operations

    /**
     * @notice Add a validator to the pool
     * @dev operatorOnly.
     */
    function enterPool(bytes calldata validatorPubKey, address depositorAddress) external;

    /**
     * @notice Remove a validator from the pool
     * @dev operatorOnly.
     */
    function leavePool(bytes calldata validatorPubKey) external;

    /**
     * @notice Add many validators to the pool
     * @dev operatorOnly.
     */
    function batchEnterPool(bytes calldata validatorPubKeys, address[] calldata depositorAddresses) external;

    /**
     * @notice Remove many validators from the pool
     * @dev operatorOnly.
     */
    function batchLeavePool(bytes calldata validatorPubKeys) external;


    // Only admin can do those operations

    /**
     * @notice Set the contract commission fee rate
     * @dev adminOnly.
     */
    function setStakeCommissionFeeRate(uint256 stakeCommissionFeeRate) external;

    /**
     * @notice Claim commission fees up to `amount`.
     * @dev adminOnly.
     */
    function claimStakeCommissionFee(address payable withdrawAddress, uint256 amount) external;

    /**
     * @notice Change the contract operator
     * @dev adminOnly.
     */
    function changeOperator(address newOperator) external;

    /**
     * @notice Disable withdrawal permission
     * @dev adminOnly.
     */
    function closePoolForWithdrawal() external;

    /**
     * @notice Enable withdrawal permission
     * @dev adminOnly.
     */
    function openPoolForWithdrawal() external;

    /**
     * @notice Transfer one or more validators to new fee pool owners.
     * @dev adminOnly.
     */
    function transferValidatorByAdmin(bytes calldata validatorPubKeys, address[] calldata toAddresses) external;

    /**
     * @notice Admin function to help users recover funds from a lost or stolen wallet
     * @dev adminOnly.
     */
    function emergencyWithdraw(address[] calldata depositor, address[] calldata withdrawAddress, uint256 amount) external;


    /**
     * @notice Admin function to transfer balance into a cold wallet for safe.
     * @dev adminOnly.
     */
    function saveToColdWallet(address wallet, uint256 amount) external;

    /**
     * @notice Admin function to transfer balance back from a cold wallet.
     * @dev adminOnly.
     */
    function loadFromColdWallet() external payable;

    // EveryOne can use those functions

    /**
     * @notice The amount of rewards a depositor can withdraw, and all rewards they have ever withdrawn
     */
    function getUserRewardInfo(address depositor) external view returns (uint256 totalRewards, uint256 unclaimedRewards, uint256 claimedRewards);

    /**
     * @notice Allow a depositor (`msg.sender`) to collect their tip rewards from the pool.
     * @dev Emits an {ValidatorRewardCollected} event.
     */
    function claimReward(address payable withdrawAddress, uint256 amount) external;


    /**
     * @notice The total count validators in the pool
     */
    function getTotalValidatorsCount() external view returns (uint256);

    /**
     * @notice A summary of the pool's current state
     */
    function getPoolInfo() external view returns (
        uint256 lastRewardBlock,
        uint256 accRewardPerValidator,
        uint256 totalValidatorsCount,
        uint256 totalClaimedStakeCommissionFee,
        uint256 totalPaidToUserRewards,
        uint256 totalTransferredToColdWallet,
        bool isPoolOpenForWithdrawal
    );

    /**
     * @notice A summary of the depositor's activity in the pool
     * @param user The depositor's address
     */
    function getUserInfo(address user) external view returns (
        uint256 validatorCount,
        uint256 totalReward,
        uint256 debit,
        uint256 claimedReward
    );

    /**
     * @notice A summary of pool stake commission fee
     */
    function getStakeCommissionFeeInfo() external view returns (
        uint256 totalStakeCommissionFee,
        uint256 unclaimedStakeCommissionFee,
        uint256 claimedStakeCommissionFee
    );

    function justifyValidatorInPool(bytes calldata validatorPubkey) external view returns (
        bool inPool,
        uint256 timestamp
    );

    ////
    /**
    * @notice The method only can be called through dxpool official nft address
    */
    function onNftTransfer(address from, address to) external;

    
    /**
     * @notice Claimed user nft reward
     */
    function claimNftReward(address payable withdrawAddress, uint256 amount) external;
}

////
interface IDxPoolOfficial {
    function getHeighestLevelByOwner(address _owner) external view returns (uint256);
}

// Storage Message
contract DxpoolStakingFeePoolStorage {
    // user struct
    struct UserInfo {
        uint128 validatorCount;
        uint128 totalReward;
        uint128 debit;
        uint128 claimedReward;
    }

    ////user nft info struct
    struct UserNftInfo {
        uint128 claimedReward;
        uint128 nftBalance;
    }

    // admin, operator address
    address internal adminAddress;
    address internal operatorAddress;

    uint256 public totalClaimedStakeCommissionFee;
    uint256 public totalPaidToUserRewards;
    uint256 public totalTransferredToColdWallet;


    uint256 public totalValidatorsCount;
    uint256 public stakeCommissionFeeRate;

    bool public isOpenForWithdrawal;

    mapping(address => UserInfo) public users;

    mapping(bytes => uint256) internal validatorOwnerAndJoinTime;

    uint256 internal accRewardPerValidator;
    uint256 internal accTotalStakeCommissionFee;

    uint256 public lastRewardBlock;
    uint256 public lastPeriodReward;
    ////
    uint256 public totalNftClaimed;
    mapping(address => UserNftInfo) public userNfts;

    uint256 [3] nftLevelValidatorReduceCount;
    uint256 public totalPaidToUserNftRewards;
    address public nftAddress;
    IDxPoolOfficial public DxPoolOfficial;
}


contract DxPoolStakingFeePool is
    IDxpoolStakingFeePool,
    DxpoolStakingFeePoolStorage,
    Initializable,
    UUPSUpgradeable,
    ReentrancyGuard
{
    receive() external payable {

    }
    using Address for address payable;

    // initialize
    function initialize(address operatorAddress_, address adminAddress_) initializer external {
        require(operatorAddress_ != address(0));
        require(adminAddress_ != address(0));
        adminAddress = adminAddress_;
        operatorAddress = operatorAddress_;
        totalValidatorsCount = 0;
        stakeCommissionFeeRate = 2000;
        isOpenForWithdrawal = true;
        accRewardPerValidator = 0;
        accTotalStakeCommissionFee = 0;
        totalTransferredToColdWallet = 0;
        lastRewardBlock  = block.number;
        lastPeriodReward = getTotalRewards();
    }

    // Only admin can update contract
    function _authorizeUpgrade(address) internal override adminOnly {}

    // decode or encode validator information
    function decodeValidatorInfo(uint256 data) public pure returns (address, uint256) {
        address ownerAddress = address(uint160(data));
        uint256 joinPoolTimestamp = data >> 224;
        return (ownerAddress, joinPoolTimestamp);
    }

    function encodeValidatorInfo(address ownerAddress, uint256 joinPoolTimestamp) public pure returns (uint256) {
        return uint256(uint160(ownerAddress)) | (joinPoolTimestamp << 224);
    }
    ////
    // get total rewards since contract created
    function getTotalRewards() public view returns (uint256) {
        return address(this).balance
        + totalTransferredToColdWallet
        + totalPaidToUserRewards
        + totalClaimedStakeCommissionFee
        + totalPaidToUserNftRewards;
    }

    // get accumulate rewards per validator
    function getAccRewardPerValidator() public view returns (uint256) {
        return accRewardPerValidator / 1e6;
    }
    ////
    // get commission have earned
    function getAccStakeCommissionFee() public view returns (uint256) {
        uint256 currentPeriodReward = getTotalRewards();
        return (
        accTotalStakeCommissionFee
        + 1e6 * (currentPeriodReward - lastPeriodReward) * stakeCommissionFeeRate / 10000
        ) / 1e6 - totalPaidToUserNftRewards;
    }

    // Compute a Reward by adding pending reward to user totalRewards
    function computeReward(address depositor) internal {
        uint256 userValidatorCount = users[depositor].validatorCount;
        if (userValidatorCount > 0) {
            uint256 pending = userValidatorCount * getAccRewardPerValidator() - users[depositor].debit;
            users[depositor].totalReward += uint128(pending);
        }
    }
    ////
    ////////
    function computeNftReward(address depositor) internal {
        uint256 userValidatorCount = users[depositor].validatorCount;
        uint256 level = DxPoolOfficial.getHeighestLevelByOwner(depositor);
        if (level > 0 && nftLevelValidatorReduceCount[level - 1] > 0 && userValidatorCount > 0) {
            uint256 pending;
            if (userValidatorCount < nftLevelValidatorReduceCount[level-1]) {
                pending = (userValidatorCount * getAccRewardPerValidator() - users[depositor].debit) * 10000 / (10000 - stakeCommissionFeeRate) * stakeCommissionFeeRate / 10000;
            } else {
                pending = (userValidatorCount * getAccRewardPerValidator() - users[depositor].debit) * 10000 / (10000 - stakeCommissionFeeRate) * stakeCommissionFeeRate / userValidatorCount * nftLevelValidatorReduceCount[level - 1] / 10000;
            }
            userNfts[depositor].nftBalance += uint128(pending);
        }
    }

    function updatePool() internal {
        if (block.number <= lastRewardBlock || totalValidatorsCount == 0) {
            return;
        }
        uint256 currentPeriodReward = getTotalRewards();
        accRewardPerValidator += 1e6 * (currentPeriodReward - lastPeriodReward) / totalValidatorsCount * (10000 - stakeCommissionFeeRate) / 10000;
        accTotalStakeCommissionFee += 1e6 * (currentPeriodReward - lastPeriodReward)  * stakeCommissionFeeRate / 10000;
        lastRewardBlock = block.number;
        lastPeriodReward = currentPeriodReward;
    }

    /**
     * Operator Functions
       Those methods Reference: https://github.com/pancakeswap/pancake-smart-contracts/blob/master/projects/farms-pools/contracts/MasterChef.sol
    */
    function enterPool(bytes calldata validatorPubKey, address depositor) external nonReentrant operatorOnly {
        // One validator joined, the previous time period ends.
        updatePool();
        _enterPool(validatorPubKey, depositor);
        emit ValidatorEntered(validatorPubKey, depositor, block.timestamp);
    }

    ////////
    function _enterPool(bytes calldata validatorPubKey,address depositor) internal {
        require(validatorOwnerAndJoinTime[validatorPubKey] == 0, "Validator already in pool");
        require(depositor != address(0), "depositorAddress not be empty");
        computeNftReward(depositor);
        computeReward(depositor);
        users[depositor].validatorCount += 1;
        totalValidatorsCount += 1;
        validatorOwnerAndJoinTime[validatorPubKey] = encodeValidatorInfo(depositor, block.timestamp);
        users[depositor].debit = uint128(users[depositor].validatorCount * getAccRewardPerValidator());
    }

    function leavePool(
        bytes calldata validatorPubKey
    ) external nonReentrant operatorOnly {
        // One validator left, the previous time period ends.
        updatePool();
        address depositor = _leavePool(validatorPubKey);
        emit ValidatorLeft(validatorPubKey, depositor, block.timestamp);
    }

    ////////
    function _leavePool(
        bytes calldata validatorPubKey
    ) internal returns (address depositorAddress) {
        (address depositor, ) = decodeValidatorInfo(validatorOwnerAndJoinTime[validatorPubKey]);
        require(depositor != address(0), "Validator not in pool");
        computeNftReward(depositor);
        computeReward(depositor);
        totalValidatorsCount -= 1;
        users[depositor].validatorCount -= 1;
        delete validatorOwnerAndJoinTime[validatorPubKey];
        users[depositor].debit = uint128(users[depositor].validatorCount * getAccRewardPerValidator());
        return depositor;
    }

    function batchEnterPool(
        bytes calldata validatorPubkeyArray,
        address[] calldata depositorAddresses
    ) external nonReentrant operatorOnly {
        require(depositorAddresses.length == 1 || depositorAddresses.length * 48 == validatorPubkeyArray.length, "Invalid depositorAddresses length");
        updatePool();
        uint256 validatorCount = validatorPubkeyArray.length / 48;
        if (depositorAddresses.length == 1) {
            for(uint256 i = 0; i < validatorCount; i++) {
                _enterPool(validatorPubkeyArray[i*48:(i+1)*48], depositorAddresses[0]);
                emit ValidatorEntered(validatorPubkeyArray[i*48:(i+1)*48], depositorAddresses[0], block.timestamp);
            }
        } else {
            for(uint256 i = 0; i < validatorCount; i++) {
                _enterPool(validatorPubkeyArray[i*48:(i+1)*48], depositorAddresses[i]);
                emit ValidatorEntered(validatorPubkeyArray[i*48:(i+1)*48], depositorAddresses[i], block.timestamp);
            }
        }
    }

    function batchLeavePool(
        bytes calldata validatorPubkeyArray
    ) external nonReentrant operatorOnly {
        require(validatorPubkeyArray.length % 48 == 0, "pubKeyArray length not multiple of 48");

        updatePool();
        uint256 validatorCount = validatorPubkeyArray.length / 48;
        for(uint256 i = 0; i < validatorCount; i++) {
            address depositor = _leavePool(validatorPubkeyArray[i*48:(i+1)*48]);
            emit ValidatorLeft(validatorPubkeyArray[i*48:(i+1)*48], depositor, block.timestamp);
        }
    }

    // @returns totalRewards, unclaimedRewards, claimedRewards
    function computeRewards(address depositor) internal view returns (uint256, uint256, uint256) {
        uint256 accRewardPerValidatorWithCurPeriod = getAccRewardPerValidator();
        if (block.number > lastRewardBlock && totalValidatorsCount > 0) {
            uint256 currentPeriodReward = getTotalRewards();
            accRewardPerValidatorWithCurPeriod +=
            (1e6 * (currentPeriodReward - lastPeriodReward) / totalValidatorsCount * (10000 - stakeCommissionFeeRate) / 10000 ) / 1e6;
        }
        // 
        uint256 totalReward = users[depositor].totalReward + users[depositor].validatorCount * accRewardPerValidatorWithCurPeriod - users[depositor].debit;
        
        if (totalReward > users[depositor].claimedReward) {
            return (totalReward, totalReward - users[depositor].claimedReward, users[depositor].claimedReward);
        } else {
            return (users[depositor].claimedReward, 0, users[depositor].claimedReward);
        }
    }
    
    // This function estimates user totalRewards, unclaimedRewards, claimedRewards based on latest timestamp.
    function getUserRewardInfo(address depositor) external view returns (uint256, uint256, uint256) {
        require(depositor != address(0), "depositorAddress not be empty");
        return computeRewards(depositor);
    }

    ////
    ////////
    function computeNftRewards(address depositor) internal view returns (uint256, uint256) {
        uint256 accRewardPerValidatorWithCurPeriod = getAccRewardPerValidator();
        if (block.number > lastRewardBlock && totalValidatorsCount > 0) {
            uint256 currentPeriodReward = getTotalRewards();
            accRewardPerValidatorWithCurPeriod +=
            (1e6 * (currentPeriodReward - lastPeriodReward) / totalValidatorsCount * (10000 - stakeCommissionFeeRate) / 10000 ) / 1e6;
        }
        uint256 userValidatorCount = users[depositor].validatorCount;
        uint256 level = DxPoolOfficial.getHeighestLevelByOwner(depositor);
        uint256 currentNftBalance;
        if (level > 0 && nftLevelValidatorReduceCount[level - 1] > 0 && userValidatorCount > 0) {
            if (userValidatorCount < nftLevelValidatorReduceCount[level-1]) {
                currentNftBalance = (userValidatorCount * accRewardPerValidatorWithCurPeriod - users[depositor].debit) * 10000 / (10000 - stakeCommissionFeeRate) * stakeCommissionFeeRate / 10000;
            } else {
                currentNftBalance = (userValidatorCount * accRewardPerValidatorWithCurPeriod - users[depositor].debit) * 10000 / (10000 - stakeCommissionFeeRate) * stakeCommissionFeeRate / userValidatorCount * nftLevelValidatorReduceCount[level - 1] / 10000;
            }
        }
        if (userNfts[depositor].nftBalance + currentNftBalance > userNfts[depositor].claimedReward) {
            return (userNfts[depositor].nftBalance + currentNftBalance, userNfts[depositor].claimedReward);
        } else {
            return (userNfts[depositor].claimedReward, userNfts[depositor].claimedReward);
        }
    }
    
    function getUserNftInfo(address depositor) external view returns (uint256, uint256) {
        require(depositor != address(0), "depositorAddress not be empty");
        return computeNftRewards(depositor);
    }

    function _claimReward(
        address depositor,
        address payable withdrawAddress,
        uint256 amount
    ) internal {
        if (withdrawAddress == address(0)) {
            withdrawAddress = payable(depositor);
        }
        computeReward(depositor);
        computeNftReward(depositor);
        users[depositor].debit = uint128(users[depositor].validatorCount * getAccRewardPerValidator());

        uint256 unClaimedReward = users[depositor].totalReward - users[depositor].claimedReward;
        if (amount == 0) {
            users[depositor].claimedReward += uint128(unClaimedReward);
            totalPaidToUserRewards += unClaimedReward;
            emit ValidatorRewardClaimed(depositor, withdrawAddress, unClaimedReward);
            require(unClaimedReward <= address(this).balance, "Please Contact stake.dxpool.com to fix");
            withdrawAddress.sendValue(unClaimedReward);
        } else {
            require(amount <= unClaimedReward, "Not enough unClaimed rewards");
            users[depositor].claimedReward += uint128(amount);
            totalPaidToUserRewards += amount;
            emit ValidatorRewardClaimed(depositor, withdrawAddress, amount);
            require(amount <= address(this).balance, "Please Contact stake.dxpool.com to fix");
            withdrawAddress.sendValue(amount);
        }
    }

    // claim rewards from the fee pool
    function claimReward(address payable withdrawAddress, uint256 amount) external nonReentrant {
        require(isOpenForWithdrawal, "Pool is not open for withdrawal");
        updatePool();
        _claimReward(msg.sender, withdrawAddress, amount);
    }

    /**
     * Admin Functions
     */
    function setStakeCommissionFeeRate(uint256 commissionFeeRate) external nonReentrant adminOnly {
        updatePool();
        stakeCommissionFeeRate = commissionFeeRate;
        emit CommissionFeeRateChanged(stakeCommissionFeeRate);
    }
    ////
    // Claim accumulated commission fees
    function claimStakeCommissionFee(address payable withdrawAddress, uint256 amount)
    external
    nonReentrant
    adminOnly
    {
        updatePool();
        uint256 totalCommissionFee = accTotalStakeCommissionFee / 1e6;
        uint256 unclaimedCommissionFee = totalCommissionFee - totalClaimedStakeCommissionFee - totalPaidToUserNftRewards;
        if (amount == 0) {
            totalClaimedStakeCommissionFee += unclaimedCommissionFee;
            emit CommissionClaimed(withdrawAddress, unclaimedCommissionFee);
            withdrawAddress.sendValue(unclaimedCommissionFee);
        } else {
            require(amount <= unclaimedCommissionFee, "Not enough unclaimed commission fee");
            totalClaimedStakeCommissionFee += amount;
            emit CommissionClaimed(withdrawAddress, amount);
            withdrawAddress.sendValue(amount);
        }
    }

    function _transferValidator(bytes calldata validatorPubKey, address to) internal {
        (address validatorOwner, ) = decodeValidatorInfo(validatorOwnerAndJoinTime[validatorPubKey]);
        require(validatorOwner != address(0), "Validator not in pool");
        require(to != address(0), "to address must be set to nonzero");
        require(to != validatorOwner, "cannot transfer validator owner to oneself");

        _leavePool(validatorPubKey);
        _enterPool(validatorPubKey, to);

        emit ValidatorTransferred(validatorPubKey, validatorOwner, to, block.timestamp);
    }

    function transferValidatorByAdmin(bytes calldata validatorPubkeys,address[] calldata toAddresses) external nonReentrant adminOnly {
        require(validatorPubkeys.length == toAddresses.length * 48, "validatorPubkeys byte array length incorrect");
        for (uint256 i = 0; i < toAddresses.length; i++) {
            _transferValidator(
                validatorPubkeys[i * 48 : (i + 1) * 48],
                toAddresses[i]
            );
        }
    }

    // Admin handle emergency situations where we want to temporarily pause all withdrawals.
    function closePoolForWithdrawal() external nonReentrant adminOnly {
        require(isOpenForWithdrawal, "Pool is already closed for withdrawal");
        isOpenForWithdrawal = false;
    }

    function openPoolForWithdrawal() external nonReentrant adminOnly {
        require(!isOpenForWithdrawal, "Pool is already open for withdrawal");
        isOpenForWithdrawal = true;
    }

    function changeOperator(address newOperatorAddress) external nonReentrant adminOnly {
        require(newOperatorAddress != address(0));
        operatorAddress = newOperatorAddress;
        emit OperatorChanged(operatorAddress);
    }

    function emergencyWithdraw (address[] calldata depositor, address[] calldata withdrawAddress, uint256 maxAmount)
    external
    nonReentrant
    adminOnly
    {
        require(withdrawAddress.length == depositor.length || withdrawAddress.length == 1, "withdrawAddress length incorrect");
        updatePool();
        if (withdrawAddress.length == 1) {
            for (uint256 i = 0; i < depositor.length; i++) {
                _claimReward(depositor[i], payable(withdrawAddress[0]), maxAmount);
            }
        } else {
            for (uint256 i = 0; i < depositor.length; i++) {
                _claimReward(depositor[i], payable(withdrawAddress[i]), maxAmount);
            }
        }
    }

    function saveToColdWallet(address wallet, uint256 amount) external nonReentrant adminOnly {
        require(amount <= address(this).balance, "Not enough balance");
        totalTransferredToColdWallet += amount;
        payable(wallet).sendValue(amount);
    }

    function loadFromColdWallet() external payable nonReentrant adminOnly {
        require(msg.value <= totalTransferredToColdWallet, "Too much transferred from cold wallet");
        totalTransferredToColdWallet -= msg.value;
    }

    function getTotalValidatorsCount() external view returns (uint256) {
        return totalValidatorsCount;
    }

    function getPoolInfo() external view returns (uint256, uint256, uint256, uint256, uint256, uint256, bool) {
        return (
        lastRewardBlock,
        getAccRewardPerValidator(),
        totalValidatorsCount,
        totalClaimedStakeCommissionFee,
        totalPaidToUserRewards,
        totalTransferredToColdWallet,
        isOpenForWithdrawal
        );
    }

    function getUserInfo(address user) external view returns (uint256, uint256, uint256, uint256) {
        return (
        users[user].validatorCount,
        users[user].totalReward,
        users[user].debit,
        users[user].claimedReward
        );
    }

    function getStakeCommissionFeeInfo() external view returns (uint256, uint256, uint256) {
        // view function
        uint256 totalCommissionFee = getAccStakeCommissionFee();
        uint256 unclaimedCommissionFee = totalCommissionFee - totalClaimedStakeCommissionFee;
        return (
        totalCommissionFee,
        unclaimedCommissionFee,
        totalClaimedStakeCommissionFee
        );
    }

    function justifyValidatorInPool(bytes calldata validatorPubkey) external view returns (bool, uint256) {
        if (validatorOwnerAndJoinTime[validatorPubkey] == 0) {
            return (false, 0);
        } else {
            (, uint256 timeStamp) = decodeValidatorInfo(validatorOwnerAndJoinTime[validatorPubkey]);
            return (true, timeStamp);
        }
    }
    ////
    ////////
    function onNftTransfer(address from, address to) external nftAddressOnly {
        updatePool();
        if (from != nftAddress) {
            computeReward(from);
            computeNftReward(from);
            users[from].debit = uint128(users[from].validatorCount * getAccRewardPerValidator());
        } else {
            emit NftClaimed(to, block.timestamp);
        }
        // 判断
        computeReward(to);
        computeNftReward(to);
        users[to].debit = uint128(users[to].validatorCount * getAccRewardPerValidator());
        emit NftTransfererred(from, to, block.timestamp);
    }

    function claimNftReward(address payable withdrawAddress, uint256 amount) external nonReentrant {
        require(isOpenForWithdrawal, "Pool is not open for withdrawal");
        updatePool();
        _claimNftReward(msg.sender, withdrawAddress, amount);
    }

    ////////
    function SetNftLevelValidatorReduceCount(uint256[3] calldata levelValidator) external adminOnly {
        require(levelValidator.length != 0, "level validator length can't be 0");
        nftLevelValidatorReduceCount = levelValidator;
    }

    ////////
    function _claimNftReward(
        address depositor,
        address payable withdrawAddress,
        uint256 amount
    ) internal {
        if (withdrawAddress == address(0)) {
            withdrawAddress = payable(depositor);
        }
        computeReward(depositor);
        computeNftReward(depositor);
        users[depositor].debit = uint128(users[depositor].validatorCount * getAccRewardPerValidator());

        uint256 unClaimedReward = userNfts[depositor].nftBalance - userNfts[depositor].claimedReward;
        if (amount == 0) {
            userNfts[depositor].claimedReward += uint128(unClaimedReward);
            totalPaidToUserNftRewards += unClaimedReward;
            emit ValidatorNftRewardClaimed(depositor, withdrawAddress, unClaimedReward);
            require(unClaimedReward <= address(this).balance, "Please Contact stake.dxpool.com to fix");
            withdrawAddress.sendValue(unClaimedReward);
        } else {
            require(amount <= unClaimedReward, "Not enough unClaimed rewards");
            totalPaidToUserNftRewards += amount;
            userNfts[depositor].claimedReward += uint128(amount);
            emit ValidatorNftRewardClaimed(depositor, withdrawAddress, amount);
            require(amount <= address(this).balance, "Please Contact stake.dxpool.com to fix");
            withdrawAddress.sendValue(amount);
        }
    }

    function setDxPoolOfficial(address _nftAddress) external adminOnly {
        require(address(0) != _nftAddress, "Nft address can not be empty");
        nftAddress = _nftAddress;
        DxPoolOfficial = IDxPoolOfficial(nftAddress);
    }

    /**
     * Modifiers
    */
    modifier operatorOnly() {
        require(msg.sender == operatorAddress, "Only Dxpool staking operator allowed");
        _;
    }

    modifier adminOnly() {
        require(msg.sender == adminAddress, "Only Dxpool staking admin allowed");
        _;
    }

    modifier nftAddressOnly() {
        require(msg.sender == nftAddress, "Only Dxpool staking nftAddress allowed");
        _;
    }
}