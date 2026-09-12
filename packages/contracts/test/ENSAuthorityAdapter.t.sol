// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
import {ENSAuthorityAdapter, IAuthorityRegistry} from "../src/ENSAuthorityAdapter.sol";
contract RegistryFixture is IAuthorityRegistry {
    address public owner; address public child; uint256 public resource = 42; bool public active; uint64 public expiry = type(uint64).max;
    function configure(address o,address c) external {owner=o;child=c;}
    function setActive(bool v) external {active=v;}
    function invalidate() external {resource++;}
    function expire() external {expiry=0;}
    function findOwner(string calldata) external view returns(address){return expiry>block.timestamp?owner:address(0);}
    function getResolver(string calldata) external pure returns(address){return address(0x123);}
    function getSubregistry(string calldata) external view returns(address){return child;}
    function getState(uint256) external view returns(State memory){return State(0,expiry,owner,1,resource);}
    function hasRoles(uint256,uint256,address a) external view returns(bool){return active&&a==owner;}
}
contract ENSAuthorityAdapterTest {
    RegistryFixture ethR; RegistryFixture fund; RegistryFixture strategy; ENSAuthorityAdapter adapter; bytes32 node;
    address constant SIGNER=address(0xA);
    function setUp() public {
        ethR=new RegistryFixture();fund=new RegistryFixture();strategy=new RegistryFixture();
        ethR.configure(address(this),address(fund));fund.configure(address(this),address(strategy));strategy.configure(SIGNER,address(0));
        adapter=new ENSAuthorityAdapter(address(ethR),address(this),"plumbline");node=adapter.enroll("momentum","agent-01");
    }
    function testGrantRevokeAndSignerBinding() public {
        require(!adapter.isAuthorized(node,SIGNER));strategy.setActive(true);require(adapter.isAuthorized(node,SIGNER));
        require(!adapter.isAuthorized(node,address(0xB)));strategy.setActive(false);require(!adapter.isAuthorized(node,SIGNER));
    }
    function testResourceInvalidation() public {strategy.setActive(true);strategy.invalidate();require(!adapter.isAuthorized(node,SIGNER));}
    function testExpiryFailsClosed() public {strategy.setActive(true);strategy.expire();require(!adapter.isAuthorized(node,SIGNER));}
    function testParentExpiryFailsClosed() public {strategy.setActive(true);fund.expire();require(!adapter.isAuthorized(node,SIGNER));}
    function testRegistryReplacementFailsClosed() public {strategy.setActive(true);fund.configure(address(this),address(new RegistryFixture()));require(!adapter.isAuthorized(node,SIGNER));}
    function testUnknownNodeFailsClosed() public {require(!adapter.isAuthorized(bytes32(uint256(123)),SIGNER));}
}
