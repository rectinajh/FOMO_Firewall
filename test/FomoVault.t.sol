// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/FomoVault.sol";

contract MockUSDC is IERC20Minimal {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        if (balanceOf[msg.sender] < amount) return false;
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        if (balanceOf[from] < amount || allowance[from][msg.sender] < amount) return false;
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract FomoVaultTest is Test {
    MockUSDC internal token;
    FomoVault internal vault;
    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);
    bytes32 internal intentId = keccak256("intent-1");
    uint256 internal constant AMOUNT = 100e6;

    function setUp() public {
        token = new MockUSDC();
        vault = new FomoVault(address(token));
        token.mint(alice, AMOUNT);
        vm.prank(alice);
        token.approve(address(vault), AMOUNT);
    }

    function testCreateIntentLocksFunds() public {
        uint64 unlockAt = uint64(block.timestamp + 60);
        vm.prank(alice);
        vault.createIntent(intentId, AMOUNT, unlockAt, keccak256("evidence"));

        FomoVault.GuardedIntent memory intent = vault.getIntent(intentId);
        assertEq(intent.owner, alice);
        assertEq(intent.amount, AMOUNT);
        assertEq(uint8(intent.status), uint8(FomoVault.IntentStatus.LOCKED));
        assertEq(token.balanceOf(alice), 0);
        assertEq(token.balanceOf(address(vault)), AMOUNT);
    }

    function testCannotRefundBeforeCooldown() public {
        _createIntent();
        vm.prank(alice);
        vm.expectRevert(FomoVault.CooldownActive.selector);
        vault.refund(intentId);
    }

    function testOnlyIntentOwnerCanRefund() public {
        _createIntent();
        vm.warp(block.timestamp + 61);
        vm.prank(bob);
        vm.expectRevert(FomoVault.NotIntentOwner.selector);
        vault.refund(intentId);
    }

    function testRefundAfterCooldown() public {
        _createIntent();
        vm.warp(block.timestamp + 61);
        vm.prank(alice);
        vault.refund(intentId);

        FomoVault.GuardedIntent memory intent = vault.getIntent(intentId);
        assertEq(uint8(intent.status), uint8(FomoVault.IntentStatus.REFUNDED));
        assertEq(token.balanceOf(alice), AMOUNT);
        assertEq(token.balanceOf(address(vault)), 0);
    }

    function testCannotCreateDuplicateIntent() public {
        _createIntent();
        vm.prank(alice);
        vm.expectRevert(FomoVault.IntentAlreadyExists.selector);
        vault.createIntent(intentId, AMOUNT, uint64(block.timestamp + 120), bytes32(0));
    }

    function testRejectsAmountAboveStorageLimit() public {
        vm.prank(alice);
        vm.expectRevert(FomoVault.AmountTooLarge.selector);
        vault.createIntent(intentId, uint256(type(uint128).max) + 1, uint64(block.timestamp + 60), bytes32(0));
    }

    function testCannotRefundTwice() public {
        _createIntent();
        vm.warp(block.timestamp + 61);
        vm.prank(alice);
        vault.refund(intentId);
        vm.prank(alice);
        vm.expectRevert(FomoVault.AlreadyRefunded.selector);
        vault.refund(intentId);
    }

    function _createIntent() internal {
        vm.prank(alice);
        vault.createIntent(intentId, AMOUNT, uint64(block.timestamp + 60), bytes32(0));
    }
}
