// Universal Properties & Linking System - Action Exports
// Re-exports all property-related server actions

export {
  getPropertyDefinitions,
  getPropertyDefinition,
  createPropertyDefinition,
  updatePropertyDefinition,
  deletePropertyDefinition,
  mergePropertyOptions,
  addPropertyOption,
  updatePropertyOption,
  removePropertyOption,
} from "./definition-actions";

export {
  getEntityProperties,
  setEntityProperty,
  removeEntityProperty,
  getEntityPropertiesWithInheritance,
  getEntitiesProperties,
  setInheritedPropertyVisibility,
} from "./entity-property-actions";

export {
  createEntityLink,
  removeEntityLink,
  getEntityLinks,
  getLinkedEntities,
  getLinkingEntities,
  searchLinkableEntities,
} from "./entity-link-actions";

export { queryEntities, queryEntitiesGroupedBy } from "./query-actions";

export {
  requireWorkspaceAccessForProperties,
  requirePropertyDefinitionAccess,
  requireEntityAccess,
  getWorkspaceIdForEntity,
  normalizePropertyName,
  isSimilarPropertyName,
} from "./context";
