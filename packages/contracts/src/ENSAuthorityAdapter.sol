// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

interface IAuthorityRegistry {
    struct State { uint8 status; uint64 expiry; address latestOwner; uint256 tokenId; uint256 resource; }
    function findOwner(string calldata label) external view returns (address);
    function getResolver(string calldata label) external view returns (address);
    function getSubregistry(string calldata label) external view returns (address);
    function getState(uint256 anyId) external view returns (State memory);
    function hasRoles(uint256 resource, uint256 roles, address account) external view returns (bool);
}

/// @notice Resolves the current ENS hierarchy on every check; never caches a token ID.
/// @dev Enrollment binds the current resource and owner so transfers/re-registration require re-enrollment.
contract ENSAuthorityAdapter {
    uint256 public constant AGENT_ACTIVE = 1 << 40; // unused nybble 10 in pinned ENSv2 registry
    address public immutable allocator;
    IAuthorityRegistry public immutable ethRegistry;
    string public fundLabel;
    bytes32 public immutable fundNode;
    struct Binding { string strategy; string agent; address registry; address signer; address resolver; uint256 resource; }
    mapping(bytes32 => Binding) private bindings;
    error OnlyAllocator();
    error InvalidIdentity();
    event AgentEnrolled(bytes32 indexed node, address registry, uint256 resource, address signer);

    constructor(address ethRegistry_, address allocator_, string memory fundLabel_) {
        require(ethRegistry_ != address(0) && allocator_ != address(0), "zero address");
        ethRegistry = IAuthorityRegistry(ethRegistry_); allocator = allocator_; fundLabel = fundLabel_;
        bytes32 ethNode = keccak256(abi.encodePacked(bytes32(0), keccak256("eth")));
        fundNode = keccak256(abi.encodePacked(ethNode, keccak256(bytes(fundLabel_))));
    }
    function enroll(string calldata strategy, string calldata agent) external returns (bytes32 node) {
        if (msg.sender != allocator) revert OnlyAllocator();
        address registry = _registry(strategy);
        IAuthorityRegistry r = IAuthorityRegistry(registry);
        address signer = r.findOwner(agent);
        IAuthorityRegistry.State memory s = r.getState(uint256(keccak256(bytes(agent))));
        if (signer == address(0) || s.expiry <= block.timestamp) revert InvalidIdentity();
        bytes32 strategyNode = keccak256(abi.encodePacked(fundNode, keccak256(bytes(strategy))));
        node = keccak256(abi.encodePacked(strategyNode, keccak256(bytes(agent))));
        bindings[node] = Binding(strategy, agent, registry, signer, r.getResolver(agent), s.resource);
        emit AgentEnrolled(node, registry, s.resource, signer);
    }
    function _registry(string memory strategy) internal view returns (address) {
        if (ethRegistry.findOwner(fundLabel) != allocator) revert InvalidIdentity();
        IAuthorityRegistry fund = IAuthorityRegistry(ethRegistry.getSubregistry(fundLabel));
        if (fund.findOwner(strategy) != allocator) revert InvalidIdentity();
        address registry = fund.getSubregistry(strategy);
        if (registry == address(0)) revert InvalidIdentity();
        return registry;
    }
    function check(bytes32 node, address signer) external view returns (bool) {
        Binding storage b = bindings[node];
        if (signer == address(0) || signer != b.signer || _registry(b.strategy) != b.registry) return false;
        IAuthorityRegistry r = IAuthorityRegistry(b.registry);
        IAuthorityRegistry.State memory s = r.getState(uint256(keccak256(bytes(b.agent))));
        return r.getResolver(b.agent) == b.resolver && s.expiry > block.timestamp && s.resource == b.resource && r.findOwner(b.agent) == signer
            && r.hasRoles(s.resource, AGENT_ACTIVE, signer);
    }
    /// @notice Fail closed for missing, expired, or malformed registry paths.
    function isAuthorized(bytes32 node, address signer) external view returns (bool) {
        try this.check(node, signer) returns (bool allowed) { return allowed; } catch { return false; }
    }
}
