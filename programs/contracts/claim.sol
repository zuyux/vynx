// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title  VynxAliasClaim
/// @notice Allows users to claim a unique on-chain alias for their VYNX creator card.
///         Fee: 0.00001 native token (ETH / SOL-equivalent on EVM-compatible networks).
contract VynxAliasClaim {
    // ─── Constants ───────────────────────────────────────────────────────────────

    /// @dev 0.00001 ether == 10_000_000_000_000 wei
    uint256 public constant CLAIM_FEE = 0.00001 ether;

    /// @dev Max alias length (chars)
    uint256 public constant MAX_ALIAS_LENGTH = 32;

    // ─── State ───────────────────────────────────────────────────────────────────

    address public owner;

    /// @dev alias (lowercase) → wallet
    mapping(string => address) public aliasByName;

    /// @dev wallet → alias (empty string = no alias)
    mapping(address => string) public aliasByWallet;

    // ─── Events ──────────────────────────────────────────────────────────────────

    event AliasClaimed(address indexed wallet, string alias);
    event AliasReleased(address indexed wallet, string alias);
    event OwnershipTransferred(address indexed previous, address indexed next);
    event Withdrawn(address indexed to, uint256 amount);

    // ─── Errors ──────────────────────────────────────────────────────────────────

    error IncorrectFee(uint256 sent, uint256 required);
    error InvalidAliasLength();
    error InvalidAliasCharacters();
    error AliasTaken(string alias);
    error WalletAlreadyHasAlias(address wallet, string current);
    error NoAliasToRelease();
    error NothingToWithdraw();
    error TransferFailed();
    error ZeroAddress();
    error Unauthorized();

    // ─── Modifiers ───────────────────────────────────────────────────────────────

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    // ─── Constructor ─────────────────────────────────────────────────────────────

    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    // ─── External Functions ──────────────────────────────────────────────────────

    /// @notice Claim a VYNX alias by paying CLAIM_FEE.
    /// @param  alias  Desired alias — lowercase alphanumeric + underscore, max 32 chars.
    function claimAlias(string calldata alias) external payable {
        if (msg.value != CLAIM_FEE) revert IncorrectFee(msg.value, CLAIM_FEE);

        uint256 len = bytes(alias).length;
        if (len == 0 || len > MAX_ALIAS_LENGTH) revert InvalidAliasLength();
        if (!_isValidAlias(alias)) revert InvalidAliasCharacters();

        if (aliasByName[alias] != address(0)) revert AliasTaken(alias);

        string memory existing = aliasByWallet[msg.sender];
        if (bytes(existing).length > 0) {
            revert WalletAlreadyHasAlias(msg.sender, existing);
        }

        aliasByName[alias] = msg.sender;
        aliasByWallet[msg.sender] = alias;

        emit AliasClaimed(msg.sender, alias);
    }

    /// @notice Release the caller's current alias (no refund).
    function releaseAlias() external {
        string memory alias = aliasByWallet[msg.sender];
        if (bytes(alias).length == 0) revert NoAliasToRelease();

        delete aliasByName[alias];
        delete aliasByWallet[msg.sender];

        emit AliasReleased(msg.sender, alias);
    }

    /// @notice Check if an alias is available.
    function isAvailable(string calldata alias) external view returns (bool) {
        return aliasByName[alias] == address(0);
    }

    /// @notice Withdraw accumulated fees to the owner.
    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        if (balance == 0) revert NothingToWithdraw();
        (bool ok, ) = owner.call{value: balance}("");
        if (!ok) revert TransferFailed();
        emit Withdrawn(owner, balance);
    }

    /// @notice Transfer contract ownership.
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    // ─── Internal Helpers ────────────────────────────────────────────────────────

    /// @dev Only allows lowercase letters (a-z), digits (0-9), and underscores (_).
    function _isValidAlias(string calldata alias) internal pure returns (bool) {
        bytes memory b = bytes(alias);
        for (uint256 i = 0; i < b.length; i++) {
            bytes1 c = b[i];
            bool isLower  = (c >= 0x61 && c <= 0x7a); // a-z
            bool isDigit  = (c >= 0x30 && c <= 0x39); // 0-9
            bool isUnderscore = (c == 0x5f);           // _
            if (!isLower && !isDigit && !isUnderscore) return false;
        }
        return true;
    }
}
