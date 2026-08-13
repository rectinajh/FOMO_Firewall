// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20Minimal {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract FomoVault {
    enum IntentStatus {
        NONE,
        LOCKED,
        REFUNDED
    }

    struct GuardedIntent {
        address owner;
        uint128 amount;
        uint64 createdAt;
        uint64 unlockAt;
        bytes32 evidenceHash;
        IntentStatus status;
    }

    IERC20Minimal public immutable usdc;
    mapping(bytes32 => GuardedIntent) private intents;
    bool private entered;

    error AmountIsZero();
    error AmountTooLarge();
    error IntentAlreadyExists();
    error UnlockTimeMustBeInFuture();
    error IntentNotFound();
    error NotIntentOwner();
    error CooldownActive();
    error AlreadyRefunded();
    error TokenTransferFailed();
    error Reentrancy();

    event IntentCreated(
        bytes32 indexed intentId, address indexed owner, uint256 amount, uint64 unlockAt, bytes32 evidenceHash
    );
    event IntentRefunded(bytes32 indexed intentId, address indexed owner, uint256 amount);

    constructor(address usdcAddress) {
        require(usdcAddress != address(0), "USDC_ZERO_ADDRESS");
        usdc = IERC20Minimal(usdcAddress);
    }

    function createIntent(bytes32 intentId, uint256 amount, uint64 unlockAt, bytes32 evidenceHash)
        external
        nonReentrant
    {
        if (amount == 0) revert AmountIsZero();
        if (amount > type(uint128).max) revert AmountTooLarge();
        // Timestamp tolerance is acceptable for a user cooldown; validators cannot
        // redirect funds or bypass the owner check with small timestamp drift.
        // forge-lint: disable-next-line(block-timestamp)
        if (unlockAt <= block.timestamp) revert UnlockTimeMustBeInFuture();
        if (intents[intentId].status != IntentStatus.NONE) revert IntentAlreadyExists();

        if (!usdc.transferFrom(msg.sender, address(this), amount)) revert TokenTransferFailed();

        intents[intentId] = GuardedIntent({
            owner: msg.sender,
            // The upper bound is checked before this narrowing conversion.
            // forge-lint: disable-next-line(unsafe-typecast)
            amount: uint128(amount),
            createdAt: uint64(block.timestamp),
            unlockAt: unlockAt,
            evidenceHash: evidenceHash,
            status: IntentStatus.LOCKED
        });

        emit IntentCreated(intentId, msg.sender, amount, unlockAt, evidenceHash);
    }

    function refund(bytes32 intentId) external nonReentrant {
        GuardedIntent storage intent = intents[intentId];
        if (intent.status == IntentStatus.NONE) revert IntentNotFound();
        if (msg.sender != intent.owner) revert NotIntentOwner();
        if (intent.status == IntentStatus.REFUNDED) revert AlreadyRefunded();
        // forge-lint: disable-next-line(block-timestamp)
        if (block.timestamp < intent.unlockAt) revert CooldownActive();

        uint256 amount = intent.amount;
        intent.status = IntentStatus.REFUNDED;
        if (!usdc.transfer(intent.owner, amount)) revert TokenTransferFailed();

        emit IntentRefunded(intentId, intent.owner, amount);
    }

    function getIntent(bytes32 intentId) external view returns (GuardedIntent memory) {
        return intents[intentId];
    }

    modifier nonReentrant() {
        if (entered) revert Reentrancy();
        entered = true;
        _;
        entered = false;
    }
}
