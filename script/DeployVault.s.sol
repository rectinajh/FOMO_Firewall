// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/FomoVault.sol";

contract DeployVault is Script {
    function run() external returns (FomoVault vault) {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address usdc = vm.envAddress("BASE_SEPOLIA_USDC_ADDRESS");

        vm.startBroadcast(deployerKey);
        vault = new FomoVault(usdc);
        vm.stopBroadcast();

        console2.log("FomoVault deployed at:", address(vault));
        console2.log("USDC:", usdc);
    }
}
