// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol"; 
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

interface IDxpoolStakingFeePool{
 function onNftTransfer(address from, address to) external;
}

contract MyToken is ERC721 ,ERC721URIStorage, Ownable,ERC721Enumerable {
    using Counters for Counters.Counter;
    using Strings for uint8;

    Counters.Counter private _tokenIdCounter;

    bytes32[] public merkleRoot;
    mapping(address => mapping (uint8 => bool)) public whitelistClaimed;
    uint256[] public maxSupply;
    mapping(uint8 => uint256) public levelTokenId;
    mapping(uint256 => uint8) public _tokenLevel;
    string public _prefixURI;
    mapping(uint256 => mapping(string => address)) public tokenidToAddress;
    IDxpoolStakingFeePool public DxpoolStakingFeePool;
    mapping(string => bool)  public tokenList;

    constructor() ERC721("MyToken", "MTK") ERC721Enumerable()  {}

    function safeMint(address to ,  uint8 _level) internal   {
        uint256 tokenId = _tokenIdCounter.current();
        require(levelTokenId[_level - 1] < maxSupply[_level - 1],"Over Supply!");
        _tokenLevel[tokenId] = _level;
        _tokenIdCounter.increment();
        levelTokenId[_level - 1] = levelTokenId[_level - 1] + 1;
        DxpoolStakingFeePool.onNftTransfer( address(this), to);
        _safeMint(to, tokenId);
        string memory uri = string(abi.encodePacked(_prefixURI, _level.toString()));
        _setTokenURI(tokenId, uri);
    }

        // verify the provided _merkleProof
    function whitelistclaim(bytes32[] calldata _merkleProof , uint8 _level) public{
        require(!whitelistClaimed[msg.sender][_level], "address has already claimed.");
        bytes32 leaf = keccak256(abi.encodePacked(msg.sender));
        require(MerkleProof.verify(_merkleProof, merkleRoot[_level - 1], leaf), "Invaild proof.");
        whitelistClaimed[msg.sender][_level] = true;
        safeMint(msg.sender , _level);
    }

    
    function whitelistclaimAll(bytes32[][] calldata _merkleProof , uint8[] calldata _level) public{
        
        require(_merkleProof.length != 0, "merkleProof length can't be 0");
        require(_level.length != 0, "level length can't be 0");
        require(_merkleProof.length == _level.length, "length isn't right");
        for(uint i = 0 ; i < _level.length ; i++ ){
        require(!whitelistClaimed[msg.sender][_level[i]], "address has already claimed.");
        bytes32 leaf = keccak256(abi.encodePacked(msg.sender));
        require(MerkleProof.verify(_merkleProof[i], merkleRoot[_level[i] - 1], leaf), "Invaild proof.");
        whitelistClaimed[msg.sender][_level[i]] = true;
        safeMint(msg.sender , _level[i]);
        }
    }

    function getHeighestLevelByOwner(address _owner) public view returns(uint256){
        uint level;
        uint HeighestLevel;
        uint256 OwnedTokenBalance = balanceOf(_owner);
        for(uint i = 0 ; i < OwnedTokenBalance ; i++){
            uint256 OwnedTokenId = tokenOfOwnerByIndex(_owner, i);
            level = _tokenLevel[OwnedTokenId];
            if(level > HeighestLevel)
            {
                HeighestLevel = level;
            }
        }
        return HeighestLevel;
    }

    function getRootHash() public view returns (bytes32[] memory) {
        return merkleRoot;
    }

    function setTokenidToAddress(uint256 _tokenid , string memory _tokenname , address _bindaddress) external {
        require(ownerOf(_tokenid) == msg.sender,"You don't own this NFT");
        require(tokenList[_tokenname] == true, "token isn't in tokenList");
        tokenidToAddress[_tokenid][_tokenname] = _bindaddress;
    }

    function setTokenList(string memory _tokenname) external onlyOwner{
        tokenList[_tokenname] = true;
    }

    function setDxpoolStakingFeePool(address _IDxpoolStakingFeePool) external onlyOwner {
        DxpoolStakingFeePool = IDxpoolStakingFeePool(_IDxpoolStakingFeePool);
    }

    function setRootHash(bytes32[] memory roothash_) external onlyOwner{
        merkleRoot = roothash_;
    }

  
    function setPrefixURI(string memory _uri) external onlyOwner{
        _prefixURI = _uri;
    }

    function setMaxSupply(uint256[] memory _MaxSupply) external onlyOwner{
        maxSupply = _MaxSupply;
    }

    function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage,ERC721Enumerable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }


    function transferFrom(
        address from,
        address to,
        uint256 tokenId
    )  public override (ERC721 , IERC721){
        DxpoolStakingFeePool.onNftTransfer( from, to);
        super.transferFrom(from, to, tokenId);
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId
    ) public override (ERC721 , IERC721){
        DxpoolStakingFeePool.onNftTransfer( from, to);
        super.safeTransferFrom(from, to, tokenId);
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId,
        bytes memory data
    ) public override (ERC721 , IERC721){
        DxpoolStakingFeePool.onNftTransfer( from, to);
        super.safeTransferFrom(from, to, tokenId, data);
    }

    function _beforeTokenTransfer(address from, address to, uint256 firstTokenId, uint256 batchSize) internal override(ERC721 ,ERC721Enumerable) {
        super._beforeTokenTransfer(from, to, firstTokenId , batchSize);
    }

}