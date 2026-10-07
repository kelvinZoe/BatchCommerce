import { describe, expect, it } from "vitest";
import { APP_RESOURCES, isAppResource, WORKSPACE_ROUTES } from "./resources";

describe("workspace route catalog", () => {
  it("has unique URLs", () => {
    const urls = WORKSPACE_ROUTES.map(({ href }) => href);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("maps every permission resource to at least one route", () => {
    const routedResources = new Set(WORKSPACE_ROUTES.map(({ resource }) => resource));
    expect([...APP_RESOURCES].filter((resource) => !routedResources.has(resource))).toEqual([]);
  });

  it("recognizes only catalog resources", () => {
    expect(isAppResource("stock_sales")).toBe(true);
    expect(isAppResource("super_admin")).toBe(false);
  });
});
