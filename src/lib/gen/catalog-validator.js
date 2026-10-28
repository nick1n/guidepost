// @ts-nocheck
/* Generated from static/kdm/catalog/data.schema.json. Do not edit. Run pnpm generate:types to regenerate. */
// \0rolldown/runtime.js
var e = (e, t) => () => (t || (e((t = { exports: {} }).exports, t, t.exports), (e = null)), t.exports),
  t = e((e) => {
    Object.defineProperty(e, "__esModule", { value: !0 });
    function t(e) {
      let t = e.length,
        n = 0,
        r = 0,
        i;
      for (; r < t;)
        (n++, (i = e.charCodeAt(r++)), i >= 55296 && i <= 56319 && r < t && ((i = e.charCodeAt(r)), (i & 64512) == 56320 && r++));
      return n;
    }
    ((e.default = t), (t.code = 'require("ajv/dist/runtime/ucs2length").default'));
  }),
  n = e((e, t) => {
    t.exports = function e(t, n) {
      if (t === n) return !0;
      if (t && n && typeof t == "object" && typeof n == "object") {
        if (t.constructor !== n.constructor) return !1;
        var r, i, a;
        if (Array.isArray(t)) {
          if (((r = t.length), r != n.length)) return !1;
          for (i = r; i-- !== 0;) if (!e(t[i], n[i])) return !1;
          return !0;
        }
        if (t.constructor === RegExp) return t.source === n.source && t.flags === n.flags;
        if (t.valueOf !== Object.prototype.valueOf) return t.valueOf() === n.valueOf();
        if (t.toString !== Object.prototype.toString) return t.toString() === n.toString();
        if (((a = Object.keys(t)), (r = a.length), r !== Object.keys(n).length)) return !1;
        for (i = r; i-- !== 0;) if (!Object.prototype.hasOwnProperty.call(n, a[i])) return !1;
        for (i = r; i-- !== 0;) {
          var o = a[i];
          if (!e(t[o], n[o])) return !1;
        }
        return !0;
      }
      return t !== t && n !== n;
    };
  }),
  r = e((e) => {
    Object.defineProperty(e, "__esModule", { value: !0 });
    var t = n();
    ((t.code = 'require("ajv/dist/runtime/equal").default'), (e.default = t));
  }),
  i = e((e, n) => {
    ((n.exports = O), (n.exports.default = O));
    var i = t().default,
      a = RegExp("^\\d{4}-\\d{2}-\\d{2}$", "u"),
      o = RegExp("^", "u"),
      s = RegExp("^(?!vignette-of-death-)", "u"),
      c = RegExp("^(?!set-)", "u"),
      l = RegExp("^(?!expansion-)", "u"),
      u = RegExp("^(?!armor-kit-)", "u"),
      d = {
        type: "object",
        required: ["name", "tags"],
        additionalProperties: !1,
        properties: {
          accessoryType: { enum: ["shirt", "dice", "other", "comic"] },
          aliases: {
            type: "array",
            items: {
              type: "string",
              minLength: 1,
            },
            uniqueItems: !0,
            minItems: 1,
          },
          announcements: {
            type: "array",
            items: { $ref: "#/$defs/announcement" },
            uniqueItems: !0,
            description: "Unique news publication dates, sorted chronologically.",
            minItems: 1,
          },
          colors: {
            type: "array",
            items: {
              type: "string",
              minLength: 1,
            },
            minItems: 1,
            description: "Color swatches in display order, paired by index with text labels when present.",
          },
          currency: {
            enum: ["USD", "EUR"],
            default: "USD",
          },
          description: {
            type: "string",
            description: "Item description.",
            minLength: 1,
          },
          editions: {
            type: "array",
            items: { $ref: "#/$defs/edition" },
            uniqueItems: !0,
            minItems: 1,
            description:
              "Selectable releases, ordered with Sim first and then chronologically by release date or release window; unknown dates last.",
          },
          gameplay: {
            const: !0,
            description: "Gameplay is false by default. Store this field only when true; editions may override it.",
          },
          gameplayContent: {
            type: "string",
            minLength: 1,
            description: "Gameplay content supplied with this item. Release differences, when known, are described here.",
          },
          handle: {
            type: "string",
            pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
            description: "Shared Kingdom Death shop product handle. Applies to every edition; omit edition handles when present.",
          },
          includes: {
            type: "array",
            items: { $ref: "#/$defs/inclusion" },
            uniqueItems: !0,
            description:
              "Known included items, optionally qualified by their editions/materials and the containing release. Partial list; unspecified editions are not automatically owned.",
            minItems: 1,
          },
          kind: {
            tsType: "string",
            enum: [
              "core",
              "promo",
              "expansion",
              "set",
              "vignette",
              "model",
              "base",
              "terrain",
              "accessory",
              "armor-kit",
              "beta",
              "box",
              "content",
              "simulator",
            ],
            description:
              "Product classification. The beta kind means all editions are Beta; box may contain mixed Beta and non-Beta editions or other boxed products. Bundles may omit kind.",
          },
          name: {
            type: "string",
            minLength: 1,
          },
          notes: {
            type: "string",
            minLength: 1,
            description: "Item history and release notes.",
          },
          price: {
            type: "integer",
            minimum: 0,
            description: "Item price in cents for products without editions. Products with editions use the edition's prices array.",
          },
          priceMinimum: {
            type: "boolean",
            default: !1,
          },
          releaseDate: {
            type: "string",
            pattern: "^\\d{4}-\\d{2}-\\d{2}$",
            description: "Release date for an item without selectable editions, YYYY-MM-DD.",
          },
          releaseWindow: {
            type: "string",
            minLength: 1,
            description: "Imprecise release date for an item without selectable editions, such as a year or a year-first quarter.",
          },
          releaseYear: {
            type: "integer",
            minimum: 1900,
            maximum: 2100,
            description:
              "Explicitly supplied product release year. Shirt and dice years are stored here rather than in editions; unknown years are omitted.",
          },
          requires: {
            type: "array",
            items: {
              type: "string",
              minLength: 1,
            },
            uniqueItems: !0,
            minItems: 1,
          },
          shop: { $ref: "#/$defs/shop" },
          size: {
            type: "string",
            minLength: 1,
            description:
              "Default physical model size or scale (mm), retained as supplied text. Edition size overrides this value; Sim never inherits it. Omit unknown sizes.",
          },
          tags: {
            type: "array",
            items: {
              type: "string",
              minLength: 1,
            },
            uniqueItems: !0,
            minItems: 1,
            description:
              "Reviewed tags plus in-stock when at least one edition has shop: in-stock. The in-stock tag is removed when no editions remain in stock.",
          },
          text: {
            type: "array",
            items: {
              type: "string",
              minLength: 1,
            },
            minItems: 1,
            description: "Labels for color swatches in matching order. Repeated labels are allowed for distinct swatches.",
          },
          url: {
            type: "string",
            description: "External listing URL. Kingdom Death shop product listings use handle instead.",
            minLength: 1,
          },
          urls: {
            type: "array",
            items: {
              type: "string",
              minLength: 1,
            },
            uniqueItems: !0,
            minItems: 1,
            description: "Additional product URLs for an item without editions.",
          },
        },
      },
      f = {
        enum: ["in-stock", "out-of-stock", "missing"],
        description: "Cached shop state for this listing. Clear it when the listing handle or external URL changes.",
      },
      p = Object.prototype.hasOwnProperty,
      m = r().default,
      h = RegExp("^[a-z0-9]+(?:-[a-z0-9]+)*$", "u"),
      g = {
        type: "object",
        required: ["id", "label", "format"],
        additionalProperties: !1,
        properties: {
          id: { $ref: "#/$defs/editionId" },
          label: {
            tsType: "string",
            type: "string",
            minLength: 1,
            description:
              "Display label, such as First Run, Encore, Plastic, or Sim. Labels may repeat; the edition ID supplies identity and includedOnly supplies inclusion status.",
            enum: "1.3,1.5,1.6,1.7,2013,2015,2025,3D Files,Box,Bust: Encore,Bust: First Run,Bust: Second Run,Bust,Deathgrey M2,Deathgrey,Deathmas 2024,Deathmas,Deathpink,Digital Files,Dwelling Key,Early Variant,Easter,Ein Lee,Encore,First Run,First,Halloween,Illusionist Key,Lokman Lam,Master Dwelling Key,Metal,Naked,Original,Painters: Cheeky,Painters: Deathgrey,Painters: Encore,Painters: First Run,Painters,Pawel Zdanowski,Photoresin,Plastic,Pledge,Preorder,Prize,Remaster: Deathgrey,Remaster: Encore,Remaster: First Run,Remaster,Resculpt: Encore,Resculpt: First Run,Resin & Metal,Resin,Second,Sim,Valentines,Wenjuinn Png,White Resin".split(
              ",",
            ),
          },
          available: {
            type: "boolean",
            const: !0,
            description: "Available in at least one matching cached shop variant. False by default; omit when unavailable or unknown.",
          },
          beta: {
            type: "boolean",
            const: !0,
            description: "Beta release. Omit for non-Beta editions.",
          },
          completedBy: {
            type: "array",
            minItems: 1,
            items: { $ref: "#/$defs/completionAlternative" },
            description:
              "Alternative recipes that provide this edition's content. Each alternative requires every referenced edition. Missing overrides block coverage. Recipes never record ownership of the product.",
          },
          equivalentTo: {
            $ref: "#/$defs/editionId",
            description:
              "Canonical edition ID on this item with identical content coverage. Packaging and prices may differ; product ownership remains explicit. Must reference a different edition without equivalentTo.",
          },
          expansion: {
            type: "string",
            description: "Workbook Expansion value.",
            minLength: 1,
          },
          format: {
            enum: ["physical", "digital"],
            description: "Delivery format of this release.",
          },
          gameplay: {
            type: "boolean",
            description: "Override of the item gameplay default (false when omitted). Store only when different from the item default.",
          },
          handle: {
            type: "string",
            pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
            description: "Kingdom Death shop product handle. Used only when the item has no shared handle.",
          },
          includedOnly: {
            type: "boolean",
            const: !0,
            description:
              "True when this edition is available only as part of another product. Omit for other or unconfirmed releases. Collection views may hide these editions.",
          },
          includesAllSim: {
            const: !0,
            description:
              "Grants every current and future simulator edition. Resolve against editions marked simulator when reading the catalog; do not materialize a static list.",
          },
          limit: { type: "boolean" },
          materials: {
            type: "array",
            items: {
              type: "string",
              minLength: 1,
            },
            uniqueItems: !0,
            minItems: 1,
            description: "Known materials of this release. Omitted means the material is unspecified.",
          },
          name: {
            type: "string",
            description: "Release-specific name when it differs from the sculpt item name, such as Plastic Ramette.",
            minLength: 1,
          },
          numbered: {
            const: !0,
            description: "The release is known to have individually numbered copies. Omit otherwise.",
          },
          priceFrom: {
            $ref: "#/$defs/editionId",
            description:
              "Reviewed standalone edition ID on this item whose own price is used only for bundle comparisons. Does not grant ownership or content equivalence. The target must have prices and cannot be included-only or have priceFrom. Omit when this edition has prices; missing prices never imply a reference.",
          },
          prices: {
            type: "array",
            items: {
              type: "integer",
              minimum: 0,
              description: "Amount in cents; inherits the item currency, which defaults to USD.",
            },
            uniqueItems: !0,
            description:
              "Known sale amounts plus current MSRP in cents. Maximum is MSRP; the array makes no active-sale claim. Price evidence and estimates remain in the audit.",
            minItems: 1,
          },
          releaseDate: {
            type: "string",
            pattern: "^\\d{4}-\\d{2}-\\d{2}$",
            description:
              "Exact release date, YYYY-MM-DD. Derive its year from this value; use releaseWindow when only a year or an imprecise date is known.",
          },
          releaseWindow: {
            type: "string",
            description:
              "An imprecise release date, including a year alone such as 2024, a quarter in year-first format such as 2026 Q4, or a named source window. No exact date is invented.",
            minLength: 1,
          },
          runSize: {
            type: "integer",
            minimum: 1,
            description:
              "Known production or sale limit. Omit unknown counts; preserve supplied First Run and Encore counts. Do not infer counts from units sold.",
          },
          shop: { $ref: "#/$defs/shop" },
          simulator: {
            const: !0,
            description: "This digital release is a Kingdom Death Simulator entitlement. Omit for other releases, including 3D Files.",
          },
          size: {
            type: "string",
            description:
              "Physical release size override when it differs from the item default. Sim never has a model size. Omit unknown placeholders.",
            minLength: 1,
          },
          url: {
            type: "string",
            minLength: 1,
            description: "External listing URL. Kingdom Death shop product listings use handle instead.",
          },
        },
        allOf: [
          {
            if: { required: ["includedOnly"] },
            then: { not: { required: ["prices"] } },
          },
        ],
      },
      _ = RegExp("^(?!(?:item|bundle)$)[a-z0-9]+(?:-[a-z0-9]+)*$", "u");
    function v(e, { instancePath: t = "", parentData: n, parentDataProperty: r, rootData: a = e, dynamicAnchors: o = {} } = {}) {
      let s = null,
        c = 0,
        l = v.evaluated;
      if ((l.dynamicProps && (l.props = void 0), l.dynamicItems && (l.items = void 0), e && typeof e == "object" && !Array.isArray(e))) {
        if (e.item === void 0) {
          let e = {
            instancePath: t,
            schemaPath: "#/required",
            keyword: "required",
            params: { missingProperty: "item" },
            message: "must have required property 'item'",
          };
          (s === null ? (s = [e]) : s.push(e), c++);
        }
        if (e.editionId === void 0) {
          let e = {
            instancePath: t,
            schemaPath: "#/required",
            keyword: "required",
            params: { missingProperty: "editionId" },
            message: "must have required property 'editionId'",
          };
          (s === null ? (s = [e]) : s.push(e), c++);
        }
        for (let n in e)
          if (n !== "item" && n !== "editionId") {
            let e = {
              instancePath: t,
              schemaPath: "#/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: n },
              message: "must NOT have additional properties",
            };
            (s === null ? (s = [e]) : s.push(e), c++);
          }
        if (e.item !== void 0) {
          let n = e.item;
          if (typeof n == "string") {
            if (i(n) < 1) {
              let e = {
                instancePath: t + "/item",
                schemaPath: "#/properties/item/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
              };
              (s === null ? (s = [e]) : s.push(e), c++);
            }
          } else {
            let e = {
              instancePath: t + "/item",
              schemaPath: "#/properties/item/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            (s === null ? (s = [e]) : s.push(e), c++);
          }
        }
        if (e.editionId !== void 0) {
          let n = e.editionId;
          if (typeof n == "string") {
            if (!_.test(n)) {
              let e = {
                instancePath: t + "/editionId",
                schemaPath: "#/$defs/editionId/pattern",
                keyword: "pattern",
                params: { pattern: "^(?!(?:item|bundle)$)[a-z0-9]+(?:-[a-z0-9]+)*$" },
                message: 'must match pattern "^(?!(?:item|bundle)$)[a-z0-9]+(?:-[a-z0-9]+)*$"',
              };
              (s === null ? (s = [e]) : s.push(e), c++);
            }
          } else {
            let e = {
              instancePath: t + "/editionId",
              schemaPath: "#/$defs/editionId/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            (s === null ? (s = [e]) : s.push(e), c++);
          }
        }
      } else {
        let e = {
          instancePath: t,
          schemaPath: "#/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        (s === null ? (s = [e]) : s.push(e), c++);
      }
      return ((v.errors = s), c === 0);
    }
    v.evaluated = {
      props: !0,
      dynamicProps: !1,
      dynamicItems: !1,
    };
    function y(e, { instancePath: t = "", parentData: n, parentDataProperty: r, rootData: i = e, dynamicAnchors: a = {} } = {}) {
      let o = null,
        s = 0,
        c = y.evaluated;
      if ((c.dynamicProps && (c.props = void 0), c.dynamicItems && (c.items = void 0), e && typeof e == "object" && !Array.isArray(e))) {
        if (e.all === void 0) {
          let e = {
            instancePath: t,
            schemaPath: "#/required",
            keyword: "required",
            params: { missingProperty: "all" },
            message: "must have required property 'all'",
          };
          (o === null ? (o = [e]) : o.push(e), s++);
        }
        for (let n in e)
          if (n !== "all") {
            let e = {
              instancePath: t,
              schemaPath: "#/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: n },
              message: "must NOT have additional properties",
            };
            (o === null ? (o = [e]) : o.push(e), s++);
          }
        if (e.all !== void 0) {
          let n = e.all;
          if (Array.isArray(n)) {
            if (n.length < 1) {
              let e = {
                instancePath: t + "/all",
                schemaPath: "#/properties/all/minItems",
                keyword: "minItems",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 items",
              };
              (o === null ? (o = [e]) : o.push(e), s++);
            }
            let e = n.length;
            for (let r = 0; r < e; r++)
              v(n[r], {
                instancePath: t + "/all/" + r,
                parentData: n,
                parentDataProperty: r,
                rootData: i,
                dynamicAnchors: a,
              }) || ((o = o === null ? v.errors : o.concat(v.errors)), (s = o.length));
            let r = n.length,
              c;
            if (r > 1) {
              outer0: for (; r--;)
                for (c = r; c--;)
                  if (m(n[r], n[c])) {
                    let e = {
                      instancePath: t + "/all",
                      schemaPath: "#/properties/all/uniqueItems",
                      keyword: "uniqueItems",
                      params: {
                        i: r,
                        j: c,
                      },
                      message: "must NOT have duplicate items (items ## " + c + " and " + r + " are identical)",
                    };
                    (o === null ? (o = [e]) : o.push(e), s++);
                    break outer0;
                  }
            }
          } else {
            let e = {
              instancePath: t + "/all",
              schemaPath: "#/properties/all/type",
              keyword: "type",
              params: { type: "array" },
              message: "must be array",
            };
            (o === null ? (o = [e]) : o.push(e), s++);
          }
        }
      } else {
        let e = {
          instancePath: t,
          schemaPath: "#/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        (o === null ? (o = [e]) : o.push(e), s++);
      }
      return ((y.errors = o), s === 0);
    }
    y.evaluated = {
      props: !0,
      dynamicProps: !1,
      dynamicItems: !1,
    };
    function b(e, { instancePath: t = "", parentData: n, parentDataProperty: r, rootData: o = e, dynamicAnchors: s = {} } = {}) {
      let c = null,
        l = 0,
        u = b.evaluated;
      (u.dynamicProps && (u.props = void 0), u.dynamicItems && (u.items = void 0));
      let d = l,
        m = !0,
        v = l;
      if (e && typeof e == "object" && !Array.isArray(e) && e.includedOnly === void 0) {
        let e = {};
        (c === null ? (c = [e]) : c.push(e), l++);
      }
      var x = v === l;
      if (((l = d), c !== null && (d ? (c.length = d) : (c = null)), x)) {
        let n = l,
          r = l,
          i = l;
        if (e && typeof e == "object" && !Array.isArray(e) && e.prices === void 0) {
          let e = {};
          (c === null ? (c = [e]) : c.push(e), l++);
        }
        if (i === l) {
          let e = {
            instancePath: t,
            schemaPath: "#/allOf/0/then/not",
            keyword: "not",
            params: {},
            message: "must NOT be valid",
          };
          (c === null ? (c = [e]) : c.push(e), l++);
        } else ((l = r), c !== null && (r ? (c.length = r) : (c = null)));
        var x = n === l;
        m = x;
      }
      if (!m) {
        let e = {
          instancePath: t,
          schemaPath: "#/allOf/0/if",
          keyword: "if",
          params: { failingKeyword: "then" },
          message: 'must match "then" schema',
        };
        (c === null ? (c = [e]) : c.push(e), l++);
      }
      if (e && typeof e == "object" && !Array.isArray(e)) {
        if (e.id === void 0) {
          let e = {
            instancePath: t,
            schemaPath: "#/required",
            keyword: "required",
            params: { missingProperty: "id" },
            message: "must have required property 'id'",
          };
          (c === null ? (c = [e]) : c.push(e), l++);
        }
        if (e.label === void 0) {
          let e = {
            instancePath: t,
            schemaPath: "#/required",
            keyword: "required",
            params: { missingProperty: "label" },
            message: "must have required property 'label'",
          };
          (c === null ? (c = [e]) : c.push(e), l++);
        }
        if (e.format === void 0) {
          let e = {
            instancePath: t,
            schemaPath: "#/required",
            keyword: "required",
            params: { missingProperty: "format" },
            message: "must have required property 'format'",
          };
          (c === null ? (c = [e]) : c.push(e), l++);
        }
        for (let n in e)
          if (!p.call(g.properties, n)) {
            let e = {
              instancePath: t,
              schemaPath: "#/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: n },
              message: "must NOT have additional properties",
            };
            (c === null ? (c = [e]) : c.push(e), l++);
          }
        if (e.id !== void 0) {
          let n = e.id;
          if (typeof n == "string") {
            if (!_.test(n)) {
              let e = {
                instancePath: t + "/id",
                schemaPath: "#/$defs/editionId/pattern",
                keyword: "pattern",
                params: { pattern: "^(?!(?:item|bundle)$)[a-z0-9]+(?:-[a-z0-9]+)*$" },
                message: 'must match pattern "^(?!(?:item|bundle)$)[a-z0-9]+(?:-[a-z0-9]+)*$"',
              };
              (c === null ? (c = [e]) : c.push(e), l++);
            }
          } else {
            let e = {
              instancePath: t + "/id",
              schemaPath: "#/$defs/editionId/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            (c === null ? (c = [e]) : c.push(e), l++);
          }
        }
        if (e.label !== void 0) {
          let n = e.label;
          if (
            n !== "1.3" &&
            n !== "1.5" &&
            n !== "1.6" &&
            n !== "1.7" &&
            n !== "2013" &&
            n !== "2015" &&
            n !== "2025" &&
            n !== "3D Files" &&
            n !== "Box" &&
            n !== "Bust: Encore" &&
            n !== "Bust: First Run" &&
            n !== "Bust: Second Run" &&
            n !== "Bust" &&
            n !== "Deathgrey M2" &&
            n !== "Deathgrey" &&
            n !== "Deathmas 2024" &&
            n !== "Deathmas" &&
            n !== "Deathpink" &&
            n !== "Digital Files" &&
            n !== "Dwelling Key" &&
            n !== "Early Variant" &&
            n !== "Easter" &&
            n !== "Ein Lee" &&
            n !== "Encore" &&
            n !== "First Run" &&
            n !== "First" &&
            n !== "Halloween" &&
            n !== "Illusionist Key" &&
            n !== "Lokman Lam" &&
            n !== "Master Dwelling Key" &&
            n !== "Metal" &&
            n !== "Naked" &&
            n !== "Original" &&
            n !== "Painters: Cheeky" &&
            n !== "Painters: Deathgrey" &&
            n !== "Painters: Encore" &&
            n !== "Painters: First Run" &&
            n !== "Painters" &&
            n !== "Pawel Zdanowski" &&
            n !== "Photoresin" &&
            n !== "Plastic" &&
            n !== "Pledge" &&
            n !== "Preorder" &&
            n !== "Prize" &&
            n !== "Remaster: Deathgrey" &&
            n !== "Remaster: Encore" &&
            n !== "Remaster: First Run" &&
            n !== "Remaster" &&
            n !== "Resculpt: Encore" &&
            n !== "Resculpt: First Run" &&
            n !== "Resin & Metal" &&
            n !== "Resin" &&
            n !== "Second" &&
            n !== "Sim" &&
            n !== "Valentines" &&
            n !== "Wenjuinn Png" &&
            n !== "White Resin"
          ) {
            let e = {
              instancePath: t + "/label",
              schemaPath: "#/properties/label/enum",
              keyword: "enum",
              params: { allowedValues: g.properties.label.enum },
              message: "must be equal to one of the allowed values",
            };
            (c === null ? (c = [e]) : c.push(e), l++);
          }
          if (typeof n == "string") {
            if (i(n) < 1) {
              let e = {
                instancePath: t + "/label",
                schemaPath: "#/properties/label/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
              };
              (c === null ? (c = [e]) : c.push(e), l++);
            }
          } else {
            let e = {
              instancePath: t + "/label",
              schemaPath: "#/properties/label/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            (c === null ? (c = [e]) : c.push(e), l++);
          }
        }
        if (e.available !== void 0) {
          let n = e.available;
          if (typeof n != "boolean") {
            let e = {
              instancePath: t + "/available",
              schemaPath: "#/properties/available/type",
              keyword: "type",
              params: { type: "boolean" },
              message: "must be boolean",
            };
            (c === null ? (c = [e]) : c.push(e), l++);
          }
          if (!0 !== n) {
            let e = {
              instancePath: t + "/available",
              schemaPath: "#/properties/available/const",
              keyword: "const",
              params: { allowedValue: !0 },
              message: "must be equal to constant",
            };
            (c === null ? (c = [e]) : c.push(e), l++);
          }
        }
        if (e.beta !== void 0) {
          let n = e.beta;
          if (typeof n != "boolean") {
            let e = {
              instancePath: t + "/beta",
              schemaPath: "#/properties/beta/type",
              keyword: "type",
              params: { type: "boolean" },
              message: "must be boolean",
            };
            (c === null ? (c = [e]) : c.push(e), l++);
          }
          if (!0 !== n) {
            let e = {
              instancePath: t + "/beta",
              schemaPath: "#/properties/beta/const",
              keyword: "const",
              params: { allowedValue: !0 },
              message: "must be equal to constant",
            };
            (c === null ? (c = [e]) : c.push(e), l++);
          }
        }
        if (e.completedBy !== void 0) {
          let n = e.completedBy;
          if (Array.isArray(n)) {
            if (n.length < 1) {
              let e = {
                instancePath: t + "/completedBy",
                schemaPath: "#/properties/completedBy/minItems",
                keyword: "minItems",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 items",
              };
              (c === null ? (c = [e]) : c.push(e), l++);
            }
            let e = n.length;
            for (let r = 0; r < e; r++)
              y(n[r], {
                instancePath: t + "/completedBy/" + r,
                parentData: n,
                parentDataProperty: r,
                rootData: o,
                dynamicAnchors: s,
              }) || ((c = c === null ? y.errors : c.concat(y.errors)), (l = c.length));
          } else {
            let e = {
              instancePath: t + "/completedBy",
              schemaPath: "#/properties/completedBy/type",
              keyword: "type",
              params: { type: "array" },
              message: "must be array",
            };
            (c === null ? (c = [e]) : c.push(e), l++);
          }
        }
        if (e.equivalentTo !== void 0) {
          let n = e.equivalentTo;
          if (typeof n == "string") {
            if (!_.test(n)) {
              let e = {
                instancePath: t + "/equivalentTo",
                schemaPath: "#/$defs/editionId/pattern",
                keyword: "pattern",
                params: { pattern: "^(?!(?:item|bundle)$)[a-z0-9]+(?:-[a-z0-9]+)*$" },
                message: 'must match pattern "^(?!(?:item|bundle)$)[a-z0-9]+(?:-[a-z0-9]+)*$"',
              };
              (c === null ? (c = [e]) : c.push(e), l++);
            }
          } else {
            let e = {
              instancePath: t + "/equivalentTo",
              schemaPath: "#/$defs/editionId/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            (c === null ? (c = [e]) : c.push(e), l++);
          }
        }
        if (e.expansion !== void 0) {
          let n = e.expansion;
          if (typeof n == "string") {
            if (i(n) < 1) {
              let e = {
                instancePath: t + "/expansion",
                schemaPath: "#/properties/expansion/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
              };
              (c === null ? (c = [e]) : c.push(e), l++);
            }
          } else {
            let e = {
              instancePath: t + "/expansion",
              schemaPath: "#/properties/expansion/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            (c === null ? (c = [e]) : c.push(e), l++);
          }
        }
        if (e.format !== void 0) {
          let n = e.format;
          if (n !== "physical" && n !== "digital") {
            let e = {
              instancePath: t + "/format",
              schemaPath: "#/properties/format/enum",
              keyword: "enum",
              params: { allowedValues: g.properties.format.enum },
              message: "must be equal to one of the allowed values",
            };
            (c === null ? (c = [e]) : c.push(e), l++);
          }
        }
        if (e.gameplay !== void 0 && typeof e.gameplay != "boolean") {
          let e = {
            instancePath: t + "/gameplay",
            schemaPath: "#/properties/gameplay/type",
            keyword: "type",
            params: { type: "boolean" },
            message: "must be boolean",
          };
          (c === null ? (c = [e]) : c.push(e), l++);
        }
        if (e.handle !== void 0) {
          let n = e.handle;
          if (typeof n == "string") {
            if (!h.test(n)) {
              let e = {
                instancePath: t + "/handle",
                schemaPath: "#/properties/handle/pattern",
                keyword: "pattern",
                params: { pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" },
                message: 'must match pattern "^[a-z0-9]+(?:-[a-z0-9]+)*$"',
              };
              (c === null ? (c = [e]) : c.push(e), l++);
            }
          } else {
            let e = {
              instancePath: t + "/handle",
              schemaPath: "#/properties/handle/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            (c === null ? (c = [e]) : c.push(e), l++);
          }
        }
        if (e.includedOnly !== void 0) {
          let n = e.includedOnly;
          if (typeof n != "boolean") {
            let e = {
              instancePath: t + "/includedOnly",
              schemaPath: "#/properties/includedOnly/type",
              keyword: "type",
              params: { type: "boolean" },
              message: "must be boolean",
            };
            (c === null ? (c = [e]) : c.push(e), l++);
          }
          if (!0 !== n) {
            let e = {
              instancePath: t + "/includedOnly",
              schemaPath: "#/properties/includedOnly/const",
              keyword: "const",
              params: { allowedValue: !0 },
              message: "must be equal to constant",
            };
            (c === null ? (c = [e]) : c.push(e), l++);
          }
        }
        if (e.includesAllSim !== void 0 && !0 !== e.includesAllSim) {
          let e = {
            instancePath: t + "/includesAllSim",
            schemaPath: "#/properties/includesAllSim/const",
            keyword: "const",
            params: { allowedValue: !0 },
            message: "must be equal to constant",
          };
          (c === null ? (c = [e]) : c.push(e), l++);
        }
        if (e.limit !== void 0 && typeof e.limit != "boolean") {
          let e = {
            instancePath: t + "/limit",
            schemaPath: "#/properties/limit/type",
            keyword: "type",
            params: { type: "boolean" },
            message: "must be boolean",
          };
          (c === null ? (c = [e]) : c.push(e), l++);
        }
        if (e.materials !== void 0) {
          let n = e.materials;
          if (Array.isArray(n)) {
            if (n.length < 1) {
              let e = {
                instancePath: t + "/materials",
                schemaPath: "#/properties/materials/minItems",
                keyword: "minItems",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 items",
              };
              (c === null ? (c = [e]) : c.push(e), l++);
            }
            let e = n.length;
            for (let r = 0; r < e; r++) {
              let e = n[r];
              if (typeof e == "string") {
                if (i(e) < 1) {
                  let e = {
                    instancePath: t + "/materials/" + r,
                    schemaPath: "#/properties/materials/items/minLength",
                    keyword: "minLength",
                    params: { limit: 1 },
                    message: "must NOT have fewer than 1 characters",
                  };
                  (c === null ? (c = [e]) : c.push(e), l++);
                }
              } else {
                let e = {
                  instancePath: t + "/materials/" + r,
                  schemaPath: "#/properties/materials/items/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                (c === null ? (c = [e]) : c.push(e), l++);
              }
            }
            let r = n.length,
              a;
            if (r > 1) {
              let e = {};
              for (; r--;) {
                let i = n[r];
                if (typeof i == "string") {
                  if (typeof e[i] == "number") {
                    a = e[i];
                    let n = {
                      instancePath: t + "/materials",
                      schemaPath: "#/properties/materials/uniqueItems",
                      keyword: "uniqueItems",
                      params: {
                        i: r,
                        j: a,
                      },
                      message: "must NOT have duplicate items (items ## " + a + " and " + r + " are identical)",
                    };
                    (c === null ? (c = [n]) : c.push(n), l++);
                    break;
                  }
                  e[i] = r;
                }
              }
            }
          } else {
            let e = {
              instancePath: t + "/materials",
              schemaPath: "#/properties/materials/type",
              keyword: "type",
              params: { type: "array" },
              message: "must be array",
            };
            (c === null ? (c = [e]) : c.push(e), l++);
          }
        }
        if (e.name !== void 0) {
          let n = e.name;
          if (typeof n == "string") {
            if (i(n) < 1) {
              let e = {
                instancePath: t + "/name",
                schemaPath: "#/properties/name/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
              };
              (c === null ? (c = [e]) : c.push(e), l++);
            }
          } else {
            let e = {
              instancePath: t + "/name",
              schemaPath: "#/properties/name/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            (c === null ? (c = [e]) : c.push(e), l++);
          }
        }
        if (e.numbered !== void 0 && !0 !== e.numbered) {
          let e = {
            instancePath: t + "/numbered",
            schemaPath: "#/properties/numbered/const",
            keyword: "const",
            params: { allowedValue: !0 },
            message: "must be equal to constant",
          };
          (c === null ? (c = [e]) : c.push(e), l++);
        }
        if (e.priceFrom !== void 0) {
          let n = e.priceFrom;
          if (typeof n == "string") {
            if (!_.test(n)) {
              let e = {
                instancePath: t + "/priceFrom",
                schemaPath: "#/$defs/editionId/pattern",
                keyword: "pattern",
                params: { pattern: "^(?!(?:item|bundle)$)[a-z0-9]+(?:-[a-z0-9]+)*$" },
                message: 'must match pattern "^(?!(?:item|bundle)$)[a-z0-9]+(?:-[a-z0-9]+)*$"',
              };
              (c === null ? (c = [e]) : c.push(e), l++);
            }
          } else {
            let e = {
              instancePath: t + "/priceFrom",
              schemaPath: "#/$defs/editionId/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            (c === null ? (c = [e]) : c.push(e), l++);
          }
        }
        if (e.prices !== void 0) {
          let n = e.prices;
          if (Array.isArray(n)) {
            if (n.length < 1) {
              let e = {
                instancePath: t + "/prices",
                schemaPath: "#/properties/prices/minItems",
                keyword: "minItems",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 items",
              };
              (c === null ? (c = [e]) : c.push(e), l++);
            }
            let e = n.length;
            for (let r = 0; r < e; r++) {
              let e = n[r];
              if (typeof e != "number" || e % 1 || isNaN(e)) {
                let e = {
                  instancePath: t + "/prices/" + r,
                  schemaPath: "#/properties/prices/items/type",
                  keyword: "type",
                  params: { type: "integer" },
                  message: "must be integer",
                };
                (c === null ? (c = [e]) : c.push(e), l++);
              }
              if (typeof e == "number" && (e < 0 || isNaN(e))) {
                let e = {
                  instancePath: t + "/prices/" + r,
                  schemaPath: "#/properties/prices/items/minimum",
                  keyword: "minimum",
                  params: {
                    comparison: ">=",
                    limit: 0,
                  },
                  message: "must be >= 0",
                };
                (c === null ? (c = [e]) : c.push(e), l++);
              }
            }
            let r = n.length,
              i;
            if (r > 1) {
              let e = {};
              for (; r--;) {
                let a = n[r];
                if (!(typeof a != "number" || a % 1 || isNaN(a))) {
                  if (typeof e[a] == "number") {
                    i = e[a];
                    let n = {
                      instancePath: t + "/prices",
                      schemaPath: "#/properties/prices/uniqueItems",
                      keyword: "uniqueItems",
                      params: {
                        i: r,
                        j: i,
                      },
                      message: "must NOT have duplicate items (items ## " + i + " and " + r + " are identical)",
                    };
                    (c === null ? (c = [n]) : c.push(n), l++);
                    break;
                  }
                  e[a] = r;
                }
              }
            }
          } else {
            let e = {
              instancePath: t + "/prices",
              schemaPath: "#/properties/prices/type",
              keyword: "type",
              params: { type: "array" },
              message: "must be array",
            };
            (c === null ? (c = [e]) : c.push(e), l++);
          }
        }
        if (e.releaseDate !== void 0) {
          let n = e.releaseDate;
          if (typeof n == "string") {
            if (!a.test(n)) {
              let e = {
                instancePath: t + "/releaseDate",
                schemaPath: "#/properties/releaseDate/pattern",
                keyword: "pattern",
                params: { pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
                message: 'must match pattern "^\\d{4}-\\d{2}-\\d{2}$"',
              };
              (c === null ? (c = [e]) : c.push(e), l++);
            }
          } else {
            let e = {
              instancePath: t + "/releaseDate",
              schemaPath: "#/properties/releaseDate/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            (c === null ? (c = [e]) : c.push(e), l++);
          }
        }
        if (e.releaseWindow !== void 0) {
          let n = e.releaseWindow;
          if (typeof n == "string") {
            if (i(n) < 1) {
              let e = {
                instancePath: t + "/releaseWindow",
                schemaPath: "#/properties/releaseWindow/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
              };
              (c === null ? (c = [e]) : c.push(e), l++);
            }
          } else {
            let e = {
              instancePath: t + "/releaseWindow",
              schemaPath: "#/properties/releaseWindow/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            (c === null ? (c = [e]) : c.push(e), l++);
          }
        }
        if (e.runSize !== void 0) {
          let n = e.runSize;
          if (typeof n != "number" || n % 1 || isNaN(n)) {
            let e = {
              instancePath: t + "/runSize",
              schemaPath: "#/properties/runSize/type",
              keyword: "type",
              params: { type: "integer" },
              message: "must be integer",
            };
            (c === null ? (c = [e]) : c.push(e), l++);
          }
          if (typeof n == "number" && (n < 1 || isNaN(n))) {
            let e = {
              instancePath: t + "/runSize",
              schemaPath: "#/properties/runSize/minimum",
              keyword: "minimum",
              params: {
                comparison: ">=",
                limit: 1,
              },
              message: "must be >= 1",
            };
            (c === null ? (c = [e]) : c.push(e), l++);
          }
        }
        if (e.shop !== void 0) {
          let n = e.shop;
          if (n !== "in-stock" && n !== "out-of-stock" && n !== "missing") {
            let e = {
              instancePath: t + "/shop",
              schemaPath: "#/$defs/shop/enum",
              keyword: "enum",
              params: { allowedValues: f.enum },
              message: "must be equal to one of the allowed values",
            };
            (c === null ? (c = [e]) : c.push(e), l++);
          }
        }
        if (e.simulator !== void 0 && !0 !== e.simulator) {
          let e = {
            instancePath: t + "/simulator",
            schemaPath: "#/properties/simulator/const",
            keyword: "const",
            params: { allowedValue: !0 },
            message: "must be equal to constant",
          };
          (c === null ? (c = [e]) : c.push(e), l++);
        }
        if (e.size !== void 0) {
          let n = e.size;
          if (typeof n == "string") {
            if (i(n) < 1) {
              let e = {
                instancePath: t + "/size",
                schemaPath: "#/properties/size/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
              };
              (c === null ? (c = [e]) : c.push(e), l++);
            }
          } else {
            let e = {
              instancePath: t + "/size",
              schemaPath: "#/properties/size/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            (c === null ? (c = [e]) : c.push(e), l++);
          }
        }
        if (e.url !== void 0) {
          let n = e.url;
          if (typeof n == "string") {
            if (i(n) < 1) {
              let e = {
                instancePath: t + "/url",
                schemaPath: "#/properties/url/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
              };
              (c === null ? (c = [e]) : c.push(e), l++);
            }
          } else {
            let e = {
              instancePath: t + "/url",
              schemaPath: "#/properties/url/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            (c === null ? (c = [e]) : c.push(e), l++);
          }
        }
      } else {
        let e = {
          instancePath: t,
          schemaPath: "#/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        (c === null ? (c = [e]) : c.push(e), l++);
      }
      return ((b.errors = c), l === 0);
    }
    b.evaluated = {
      props: !0,
      dynamicProps: !1,
      dynamicItems: !1,
    };
    function x(e, { instancePath: t = "", parentData: n, parentDataProperty: r, rootData: a = e, dynamicAnchors: o = {} } = {}) {
      let s = null,
        c = 0,
        l = x.evaluated;
      (l.dynamicProps && (l.props = void 0), l.dynamicItems && (l.items = void 0));
      let u = c,
        d = !1,
        f = null,
        p = c;
      if (typeof e == "string") {
        if (i(e) < 1) {
          let e = {
            instancePath: t,
            schemaPath: "#/oneOf/0/minLength",
            keyword: "minLength",
            params: { limit: 1 },
            message: "must NOT have fewer than 1 characters",
          };
          (s === null ? (s = [e]) : s.push(e), c++);
        }
      } else {
        let e = {
          instancePath: t,
          schemaPath: "#/oneOf/0/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        (s === null ? (s = [e]) : s.push(e), c++);
      }
      var h = p === c;
      h && ((d = !0), (f = 0));
      let g = c;
      if (e && typeof e == "object" && !Array.isArray(e)) {
        if (e.item === void 0) {
          let e = {
            instancePath: t,
            schemaPath: "#/oneOf/1/required",
            keyword: "required",
            params: { missingProperty: "item" },
            message: "must have required property 'item'",
          };
          (s === null ? (s = [e]) : s.push(e), c++);
        }
        for (let n in e)
          if (n !== "item" && n !== "editionId" && n !== "materials" && n !== "parentEditionIds" && n !== "shortLabel") {
            let e = {
              instancePath: t,
              schemaPath: "#/oneOf/1/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: n },
              message: "must NOT have additional properties",
            };
            (s === null ? (s = [e]) : s.push(e), c++);
          }
        if (e.item !== void 0) {
          let n = e.item;
          if (typeof n == "string") {
            if (i(n) < 1) {
              let e = {
                instancePath: t + "/item",
                schemaPath: "#/oneOf/1/properties/item/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
              };
              (s === null ? (s = [e]) : s.push(e), c++);
            }
          } else {
            let e = {
              instancePath: t + "/item",
              schemaPath: "#/oneOf/1/properties/item/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            (s === null ? (s = [e]) : s.push(e), c++);
          }
        }
        if (e.editionId !== void 0) {
          let n = e.editionId;
          if (typeof n == "string") {
            if (!_.test(n)) {
              let e = {
                instancePath: t + "/editionId",
                schemaPath: "#/$defs/editionId/pattern",
                keyword: "pattern",
                params: { pattern: "^(?!(?:item|bundle)$)[a-z0-9]+(?:-[a-z0-9]+)*$" },
                message: 'must match pattern "^(?!(?:item|bundle)$)[a-z0-9]+(?:-[a-z0-9]+)*$"',
              };
              (s === null ? (s = [e]) : s.push(e), c++);
            }
          } else {
            let e = {
              instancePath: t + "/editionId",
              schemaPath: "#/$defs/editionId/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            (s === null ? (s = [e]) : s.push(e), c++);
          }
        }
        if (e.materials !== void 0) {
          let n = e.materials;
          if (Array.isArray(n)) {
            if (n.length < 1) {
              let e = {
                instancePath: t + "/materials",
                schemaPath: "#/oneOf/1/properties/materials/minItems",
                keyword: "minItems",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 items",
              };
              (s === null ? (s = [e]) : s.push(e), c++);
            }
            let e = n.length;
            for (let r = 0; r < e; r++) {
              let e = n[r];
              if (typeof e == "string") {
                if (i(e) < 1) {
                  let e = {
                    instancePath: t + "/materials/" + r,
                    schemaPath: "#/oneOf/1/properties/materials/items/minLength",
                    keyword: "minLength",
                    params: { limit: 1 },
                    message: "must NOT have fewer than 1 characters",
                  };
                  (s === null ? (s = [e]) : s.push(e), c++);
                }
              } else {
                let e = {
                  instancePath: t + "/materials/" + r,
                  schemaPath: "#/oneOf/1/properties/materials/items/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                (s === null ? (s = [e]) : s.push(e), c++);
              }
            }
            let r = n.length,
              a;
            if (r > 1) {
              let e = {};
              for (; r--;) {
                let i = n[r];
                if (typeof i == "string") {
                  if (typeof e[i] == "number") {
                    a = e[i];
                    let n = {
                      instancePath: t + "/materials",
                      schemaPath: "#/oneOf/1/properties/materials/uniqueItems",
                      keyword: "uniqueItems",
                      params: {
                        i: r,
                        j: a,
                      },
                      message: "must NOT have duplicate items (items ## " + a + " and " + r + " are identical)",
                    };
                    (s === null ? (s = [n]) : s.push(n), c++);
                    break;
                  }
                  e[i] = r;
                }
              }
            }
          } else {
            let e = {
              instancePath: t + "/materials",
              schemaPath: "#/oneOf/1/properties/materials/type",
              keyword: "type",
              params: { type: "array" },
              message: "must be array",
            };
            (s === null ? (s = [e]) : s.push(e), c++);
          }
        }
        if (e.parentEditionIds !== void 0) {
          let n = e.parentEditionIds;
          if (Array.isArray(n)) {
            if (n.length < 1) {
              let e = {
                instancePath: t + "/parentEditionIds",
                schemaPath: "#/oneOf/1/properties/parentEditionIds/minItems",
                keyword: "minItems",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 items",
              };
              (s === null ? (s = [e]) : s.push(e), c++);
            }
            let e = n.length;
            for (let r = 0; r < e; r++) {
              let e = n[r];
              if (typeof e == "string") {
                if (!_.test(e)) {
                  let e = {
                    instancePath: t + "/parentEditionIds/" + r,
                    schemaPath: "#/$defs/editionId/pattern",
                    keyword: "pattern",
                    params: { pattern: "^(?!(?:item|bundle)$)[a-z0-9]+(?:-[a-z0-9]+)*$" },
                    message: 'must match pattern "^(?!(?:item|bundle)$)[a-z0-9]+(?:-[a-z0-9]+)*$"',
                  };
                  (s === null ? (s = [e]) : s.push(e), c++);
                }
              } else {
                let e = {
                  instancePath: t + "/parentEditionIds/" + r,
                  schemaPath: "#/$defs/editionId/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                (s === null ? (s = [e]) : s.push(e), c++);
              }
            }
            let r = n.length,
              i;
            if (r > 1) {
              outer0: for (; r--;)
                for (i = r; i--;)
                  if (m(n[r], n[i])) {
                    let e = {
                      instancePath: t + "/parentEditionIds",
                      schemaPath: "#/oneOf/1/properties/parentEditionIds/uniqueItems",
                      keyword: "uniqueItems",
                      params: {
                        i: r,
                        j: i,
                      },
                      message: "must NOT have duplicate items (items ## " + i + " and " + r + " are identical)",
                    };
                    (s === null ? (s = [e]) : s.push(e), c++);
                    break outer0;
                  }
            }
          } else {
            let e = {
              instancePath: t + "/parentEditionIds",
              schemaPath: "#/oneOf/1/properties/parentEditionIds/type",
              keyword: "type",
              params: { type: "array" },
              message: "must be array",
            };
            (s === null ? (s = [e]) : s.push(e), c++);
          }
        }
        if (e.shortLabel !== void 0) {
          let n = e.shortLabel;
          if (typeof n == "string") {
            if (i(n) < 1) {
              let e = {
                instancePath: t + "/shortLabel",
                schemaPath: "#/oneOf/1/properties/shortLabel/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
              };
              (s === null ? (s = [e]) : s.push(e), c++);
            }
          } else {
            let e = {
              instancePath: t + "/shortLabel",
              schemaPath: "#/oneOf/1/properties/shortLabel/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            (s === null ? (s = [e]) : s.push(e), c++);
          }
        }
      } else {
        let e = {
          instancePath: t,
          schemaPath: "#/oneOf/1/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        (s === null ? (s = [e]) : s.push(e), c++);
      }
      var h = g === c;
      if (h && d) ((d = !1), (f = [f, 1]));
      else if (h) {
        ((d = !0), (f = 1));
        var v = !0;
      }
      if (d) ((c = u), s !== null && (u ? (s.length = u) : (s = null)));
      else {
        let e = {
          instancePath: t,
          schemaPath: "#/oneOf",
          keyword: "oneOf",
          params: { passingSchemas: f },
          message: "must match exactly one schema in oneOf",
        };
        (s === null ? (s = [e]) : s.push(e), c++);
      }
      return ((x.errors = s), (l.props = v), c === 0);
    }
    x.evaluated = {
      dynamicProps: !0,
      dynamicItems: !1,
    };
    function S(e, { instancePath: t = "", parentData: n, parentDataProperty: r, rootData: o = e, dynamicAnchors: s = {} } = {}) {
      let c = null,
        l = 0,
        u = S.evaluated;
      if ((u.dynamicProps && (u.props = void 0), u.dynamicItems && (u.items = void 0), e && typeof e == "object" && !Array.isArray(e))) {
        if (e.name === void 0) {
          let e = {
            instancePath: t,
            schemaPath: "#/required",
            keyword: "required",
            params: { missingProperty: "name" },
            message: "must have required property 'name'",
          };
          (c === null ? (c = [e]) : c.push(e), l++);
        }
        if (e.tags === void 0) {
          let e = {
            instancePath: t,
            schemaPath: "#/required",
            keyword: "required",
            params: { missingProperty: "tags" },
            message: "must have required property 'tags'",
          };
          (c === null ? (c = [e]) : c.push(e), l++);
        }
        for (let n in e)
          if (!p.call(d.properties, n)) {
            let e = {
              instancePath: t,
              schemaPath: "#/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: n },
              message: "must NOT have additional properties",
            };
            (c === null ? (c = [e]) : c.push(e), l++);
          }
        if (e.accessoryType !== void 0) {
          let n = e.accessoryType;
          if (n !== "shirt" && n !== "dice" && n !== "other" && n !== "comic") {
            let e = {
              instancePath: t + "/accessoryType",
              schemaPath: "#/properties/accessoryType/enum",
              keyword: "enum",
              params: { allowedValues: d.properties.accessoryType.enum },
              message: "must be equal to one of the allowed values",
            };
            (c === null ? (c = [e]) : c.push(e), l++);
          }
        }
        if (e.aliases !== void 0) {
          let n = e.aliases;
          if (Array.isArray(n)) {
            if (n.length < 1) {
              let e = {
                instancePath: t + "/aliases",
                schemaPath: "#/properties/aliases/minItems",
                keyword: "minItems",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 items",
              };
              (c === null ? (c = [e]) : c.push(e), l++);
            }
            let e = n.length;
            for (let r = 0; r < e; r++) {
              let e = n[r];
              if (typeof e == "string") {
                if (i(e) < 1) {
                  let e = {
                    instancePath: t + "/aliases/" + r,
                    schemaPath: "#/properties/aliases/items/minLength",
                    keyword: "minLength",
                    params: { limit: 1 },
                    message: "must NOT have fewer than 1 characters",
                  };
                  (c === null ? (c = [e]) : c.push(e), l++);
                }
              } else {
                let e = {
                  instancePath: t + "/aliases/" + r,
                  schemaPath: "#/properties/aliases/items/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                (c === null ? (c = [e]) : c.push(e), l++);
              }
            }
            let r = n.length,
              a;
            if (r > 1) {
              let e = {};
              for (; r--;) {
                let i = n[r];
                if (typeof i == "string") {
                  if (typeof e[i] == "number") {
                    a = e[i];
                    let n = {
                      instancePath: t + "/aliases",
                      schemaPath: "#/properties/aliases/uniqueItems",
                      keyword: "uniqueItems",
                      params: {
                        i: r,
                        j: a,
                      },
                      message: "must NOT have duplicate items (items ## " + a + " and " + r + " are identical)",
                    };
                    (c === null ? (c = [n]) : c.push(n), l++);
                    break;
                  }
                  e[i] = r;
                }
              }
            }
          } else {
            let e = {
              instancePath: t + "/aliases",
              schemaPath: "#/properties/aliases/type",
              keyword: "type",
              params: { type: "array" },
              message: "must be array",
            };
            (c === null ? (c = [e]) : c.push(e), l++);
          }
        }
        if (e.announcements !== void 0) {
          let n = e.announcements;
          if (Array.isArray(n)) {
            if (n.length < 1) {
              let e = {
                instancePath: t + "/announcements",
                schemaPath: "#/properties/announcements/minItems",
                keyword: "minItems",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 items",
              };
              (c === null ? (c = [e]) : c.push(e), l++);
            }
            let e = n.length;
            for (let r = 0; r < e; r++) {
              let e = n[r];
              if (typeof e == "string") {
                if (!a.test(e)) {
                  let e = {
                    instancePath: t + "/announcements/" + r,
                    schemaPath: "#/$defs/announcement/pattern",
                    keyword: "pattern",
                    params: { pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
                    message: 'must match pattern "^\\d{4}-\\d{2}-\\d{2}$"',
                  };
                  (c === null ? (c = [e]) : c.push(e), l++);
                }
              } else {
                let e = {
                  instancePath: t + "/announcements/" + r,
                  schemaPath: "#/$defs/announcement/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                (c === null ? (c = [e]) : c.push(e), l++);
              }
            }
            let r = n.length,
              i;
            if (r > 1) {
              outer0: for (; r--;)
                for (i = r; i--;)
                  if (m(n[r], n[i])) {
                    let e = {
                      instancePath: t + "/announcements",
                      schemaPath: "#/properties/announcements/uniqueItems",
                      keyword: "uniqueItems",
                      params: {
                        i: r,
                        j: i,
                      },
                      message: "must NOT have duplicate items (items ## " + i + " and " + r + " are identical)",
                    };
                    (c === null ? (c = [e]) : c.push(e), l++);
                    break outer0;
                  }
            }
          } else {
            let e = {
              instancePath: t + "/announcements",
              schemaPath: "#/properties/announcements/type",
              keyword: "type",
              params: { type: "array" },
              message: "must be array",
            };
            (c === null ? (c = [e]) : c.push(e), l++);
          }
        }
        if (e.colors !== void 0) {
          let n = e.colors;
          if (Array.isArray(n)) {
            if (n.length < 1) {
              let e = {
                instancePath: t + "/colors",
                schemaPath: "#/properties/colors/minItems",
                keyword: "minItems",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 items",
              };
              (c === null ? (c = [e]) : c.push(e), l++);
            }
            let e = n.length;
            for (let r = 0; r < e; r++) {
              let e = n[r];
              if (typeof e == "string") {
                if (i(e) < 1) {
                  let e = {
                    instancePath: t + "/colors/" + r,
                    schemaPath: "#/properties/colors/items/minLength",
                    keyword: "minLength",
                    params: { limit: 1 },
                    message: "must NOT have fewer than 1 characters",
                  };
                  (c === null ? (c = [e]) : c.push(e), l++);
                }
              } else {
                let e = {
                  instancePath: t + "/colors/" + r,
                  schemaPath: "#/properties/colors/items/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                (c === null ? (c = [e]) : c.push(e), l++);
              }
            }
          } else {
            let e = {
              instancePath: t + "/colors",
              schemaPath: "#/properties/colors/type",
              keyword: "type",
              params: { type: "array" },
              message: "must be array",
            };
            (c === null ? (c = [e]) : c.push(e), l++);
          }
        }
        if (e.currency !== void 0) {
          let n = e.currency;
          if (n !== "USD" && n !== "EUR") {
            let e = {
              instancePath: t + "/currency",
              schemaPath: "#/properties/currency/enum",
              keyword: "enum",
              params: { allowedValues: d.properties.currency.enum },
              message: "must be equal to one of the allowed values",
            };
            (c === null ? (c = [e]) : c.push(e), l++);
          }
        }
        if (e.description !== void 0) {
          let n = e.description;
          if (typeof n == "string") {
            if (i(n) < 1) {
              let e = {
                instancePath: t + "/description",
                schemaPath: "#/properties/description/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
              };
              (c === null ? (c = [e]) : c.push(e), l++);
            }
          } else {
            let e = {
              instancePath: t + "/description",
              schemaPath: "#/properties/description/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            (c === null ? (c = [e]) : c.push(e), l++);
          }
        }
        if (e.editions !== void 0) {
          let n = e.editions;
          if (Array.isArray(n)) {
            if (n.length < 1) {
              let e = {
                instancePath: t + "/editions",
                schemaPath: "#/properties/editions/minItems",
                keyword: "minItems",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 items",
              };
              (c === null ? (c = [e]) : c.push(e), l++);
            }
            let e = n.length;
            for (let r = 0; r < e; r++)
              b(n[r], {
                instancePath: t + "/editions/" + r,
                parentData: n,
                parentDataProperty: r,
                rootData: o,
                dynamicAnchors: s,
              }) || ((c = c === null ? b.errors : c.concat(b.errors)), (l = c.length));
            let r = n.length,
              i;
            if (r > 1) {
              outer1: for (; r--;)
                for (i = r; i--;)
                  if (m(n[r], n[i])) {
                    let e = {
                      instancePath: t + "/editions",
                      schemaPath: "#/properties/editions/uniqueItems",
                      keyword: "uniqueItems",
                      params: {
                        i: r,
                        j: i,
                      },
                      message: "must NOT have duplicate items (items ## " + i + " and " + r + " are identical)",
                    };
                    (c === null ? (c = [e]) : c.push(e), l++);
                    break outer1;
                  }
            }
          } else {
            let e = {
              instancePath: t + "/editions",
              schemaPath: "#/properties/editions/type",
              keyword: "type",
              params: { type: "array" },
              message: "must be array",
            };
            (c === null ? (c = [e]) : c.push(e), l++);
          }
        }
        if (e.gameplay !== void 0 && !0 !== e.gameplay) {
          let e = {
            instancePath: t + "/gameplay",
            schemaPath: "#/properties/gameplay/const",
            keyword: "const",
            params: { allowedValue: !0 },
            message: "must be equal to constant",
          };
          (c === null ? (c = [e]) : c.push(e), l++);
        }
        if (e.gameplayContent !== void 0) {
          let n = e.gameplayContent;
          if (typeof n == "string") {
            if (i(n) < 1) {
              let e = {
                instancePath: t + "/gameplayContent",
                schemaPath: "#/properties/gameplayContent/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
              };
              (c === null ? (c = [e]) : c.push(e), l++);
            }
          } else {
            let e = {
              instancePath: t + "/gameplayContent",
              schemaPath: "#/properties/gameplayContent/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            (c === null ? (c = [e]) : c.push(e), l++);
          }
        }
        if (e.handle !== void 0) {
          let n = e.handle;
          if (typeof n == "string") {
            if (!h.test(n)) {
              let e = {
                instancePath: t + "/handle",
                schemaPath: "#/properties/handle/pattern",
                keyword: "pattern",
                params: { pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" },
                message: 'must match pattern "^[a-z0-9]+(?:-[a-z0-9]+)*$"',
              };
              (c === null ? (c = [e]) : c.push(e), l++);
            }
          } else {
            let e = {
              instancePath: t + "/handle",
              schemaPath: "#/properties/handle/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            (c === null ? (c = [e]) : c.push(e), l++);
          }
        }
        if (e.includes !== void 0) {
          let n = e.includes;
          if (Array.isArray(n)) {
            if (n.length < 1) {
              let e = {
                instancePath: t + "/includes",
                schemaPath: "#/properties/includes/minItems",
                keyword: "minItems",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 items",
              };
              (c === null ? (c = [e]) : c.push(e), l++);
            }
            let e = n.length;
            for (let r = 0; r < e; r++)
              x(n[r], {
                instancePath: t + "/includes/" + r,
                parentData: n,
                parentDataProperty: r,
                rootData: o,
                dynamicAnchors: s,
              }) || ((c = c === null ? x.errors : c.concat(x.errors)), (l = c.length));
            let r = n.length,
              i;
            if (r > 1) {
              outer2: for (; r--;)
                for (i = r; i--;)
                  if (m(n[r], n[i])) {
                    let e = {
                      instancePath: t + "/includes",
                      schemaPath: "#/properties/includes/uniqueItems",
                      keyword: "uniqueItems",
                      params: {
                        i: r,
                        j: i,
                      },
                      message: "must NOT have duplicate items (items ## " + i + " and " + r + " are identical)",
                    };
                    (c === null ? (c = [e]) : c.push(e), l++);
                    break outer2;
                  }
            }
          } else {
            let e = {
              instancePath: t + "/includes",
              schemaPath: "#/properties/includes/type",
              keyword: "type",
              params: { type: "array" },
              message: "must be array",
            };
            (c === null ? (c = [e]) : c.push(e), l++);
          }
        }
        if (e.kind !== void 0) {
          let n = e.kind;
          if (
            n !== "core" &&
            n !== "promo" &&
            n !== "expansion" &&
            n !== "set" &&
            n !== "vignette" &&
            n !== "model" &&
            n !== "base" &&
            n !== "terrain" &&
            n !== "accessory" &&
            n !== "armor-kit" &&
            n !== "beta" &&
            n !== "box" &&
            n !== "content" &&
            n !== "simulator"
          ) {
            let e = {
              instancePath: t + "/kind",
              schemaPath: "#/properties/kind/enum",
              keyword: "enum",
              params: { allowedValues: d.properties.kind.enum },
              message: "must be equal to one of the allowed values",
            };
            (c === null ? (c = [e]) : c.push(e), l++);
          }
        }
        if (e.name !== void 0) {
          let n = e.name;
          if (typeof n == "string") {
            if (i(n) < 1) {
              let e = {
                instancePath: t + "/name",
                schemaPath: "#/properties/name/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
              };
              (c === null ? (c = [e]) : c.push(e), l++);
            }
          } else {
            let e = {
              instancePath: t + "/name",
              schemaPath: "#/properties/name/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            (c === null ? (c = [e]) : c.push(e), l++);
          }
        }
        if (e.notes !== void 0) {
          let n = e.notes;
          if (typeof n == "string") {
            if (i(n) < 1) {
              let e = {
                instancePath: t + "/notes",
                schemaPath: "#/properties/notes/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
              };
              (c === null ? (c = [e]) : c.push(e), l++);
            }
          } else {
            let e = {
              instancePath: t + "/notes",
              schemaPath: "#/properties/notes/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            (c === null ? (c = [e]) : c.push(e), l++);
          }
        }
        if (e.price !== void 0) {
          let n = e.price;
          if (typeof n != "number" || n % 1 || isNaN(n)) {
            let e = {
              instancePath: t + "/price",
              schemaPath: "#/properties/price/type",
              keyword: "type",
              params: { type: "integer" },
              message: "must be integer",
            };
            (c === null ? (c = [e]) : c.push(e), l++);
          }
          if (typeof n == "number" && (n < 0 || isNaN(n))) {
            let e = {
              instancePath: t + "/price",
              schemaPath: "#/properties/price/minimum",
              keyword: "minimum",
              params: {
                comparison: ">=",
                limit: 0,
              },
              message: "must be >= 0",
            };
            (c === null ? (c = [e]) : c.push(e), l++);
          }
        }
        if (e.priceMinimum !== void 0 && typeof e.priceMinimum != "boolean") {
          let e = {
            instancePath: t + "/priceMinimum",
            schemaPath: "#/properties/priceMinimum/type",
            keyword: "type",
            params: { type: "boolean" },
            message: "must be boolean",
          };
          (c === null ? (c = [e]) : c.push(e), l++);
        }
        if (e.releaseDate !== void 0) {
          let n = e.releaseDate;
          if (typeof n == "string") {
            if (!a.test(n)) {
              let e = {
                instancePath: t + "/releaseDate",
                schemaPath: "#/properties/releaseDate/pattern",
                keyword: "pattern",
                params: { pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
                message: 'must match pattern "^\\d{4}-\\d{2}-\\d{2}$"',
              };
              (c === null ? (c = [e]) : c.push(e), l++);
            }
          } else {
            let e = {
              instancePath: t + "/releaseDate",
              schemaPath: "#/properties/releaseDate/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            (c === null ? (c = [e]) : c.push(e), l++);
          }
        }
        if (e.releaseWindow !== void 0) {
          let n = e.releaseWindow;
          if (typeof n == "string") {
            if (i(n) < 1) {
              let e = {
                instancePath: t + "/releaseWindow",
                schemaPath: "#/properties/releaseWindow/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
              };
              (c === null ? (c = [e]) : c.push(e), l++);
            }
          } else {
            let e = {
              instancePath: t + "/releaseWindow",
              schemaPath: "#/properties/releaseWindow/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            (c === null ? (c = [e]) : c.push(e), l++);
          }
        }
        if (e.releaseYear !== void 0) {
          let n = e.releaseYear;
          if (typeof n != "number" || n % 1 || isNaN(n)) {
            let e = {
              instancePath: t + "/releaseYear",
              schemaPath: "#/properties/releaseYear/type",
              keyword: "type",
              params: { type: "integer" },
              message: "must be integer",
            };
            (c === null ? (c = [e]) : c.push(e), l++);
          }
          if (typeof n == "number") {
            if (n > 2100 || isNaN(n)) {
              let e = {
                instancePath: t + "/releaseYear",
                schemaPath: "#/properties/releaseYear/maximum",
                keyword: "maximum",
                params: {
                  comparison: "<=",
                  limit: 2100,
                },
                message: "must be <= 2100",
              };
              (c === null ? (c = [e]) : c.push(e), l++);
            }
            if (n < 1900 || isNaN(n)) {
              let e = {
                instancePath: t + "/releaseYear",
                schemaPath: "#/properties/releaseYear/minimum",
                keyword: "minimum",
                params: {
                  comparison: ">=",
                  limit: 1900,
                },
                message: "must be >= 1900",
              };
              (c === null ? (c = [e]) : c.push(e), l++);
            }
          }
        }
        if (e.requires !== void 0) {
          let n = e.requires;
          if (Array.isArray(n)) {
            if (n.length < 1) {
              let e = {
                instancePath: t + "/requires",
                schemaPath: "#/properties/requires/minItems",
                keyword: "minItems",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 items",
              };
              (c === null ? (c = [e]) : c.push(e), l++);
            }
            let e = n.length;
            for (let r = 0; r < e; r++) {
              let e = n[r];
              if (typeof e == "string") {
                if (i(e) < 1) {
                  let e = {
                    instancePath: t + "/requires/" + r,
                    schemaPath: "#/properties/requires/items/minLength",
                    keyword: "minLength",
                    params: { limit: 1 },
                    message: "must NOT have fewer than 1 characters",
                  };
                  (c === null ? (c = [e]) : c.push(e), l++);
                }
              } else {
                let e = {
                  instancePath: t + "/requires/" + r,
                  schemaPath: "#/properties/requires/items/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                (c === null ? (c = [e]) : c.push(e), l++);
              }
            }
            let r = n.length,
              a;
            if (r > 1) {
              let e = {};
              for (; r--;) {
                let i = n[r];
                if (typeof i == "string") {
                  if (typeof e[i] == "number") {
                    a = e[i];
                    let n = {
                      instancePath: t + "/requires",
                      schemaPath: "#/properties/requires/uniqueItems",
                      keyword: "uniqueItems",
                      params: {
                        i: r,
                        j: a,
                      },
                      message: "must NOT have duplicate items (items ## " + a + " and " + r + " are identical)",
                    };
                    (c === null ? (c = [n]) : c.push(n), l++);
                    break;
                  }
                  e[i] = r;
                }
              }
            }
          } else {
            let e = {
              instancePath: t + "/requires",
              schemaPath: "#/properties/requires/type",
              keyword: "type",
              params: { type: "array" },
              message: "must be array",
            };
            (c === null ? (c = [e]) : c.push(e), l++);
          }
        }
        if (e.shop !== void 0) {
          let n = e.shop;
          if (n !== "in-stock" && n !== "out-of-stock" && n !== "missing") {
            let e = {
              instancePath: t + "/shop",
              schemaPath: "#/$defs/shop/enum",
              keyword: "enum",
              params: { allowedValues: f.enum },
              message: "must be equal to one of the allowed values",
            };
            (c === null ? (c = [e]) : c.push(e), l++);
          }
        }
        if (e.size !== void 0) {
          let n = e.size;
          if (typeof n == "string") {
            if (i(n) < 1) {
              let e = {
                instancePath: t + "/size",
                schemaPath: "#/properties/size/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
              };
              (c === null ? (c = [e]) : c.push(e), l++);
            }
          } else {
            let e = {
              instancePath: t + "/size",
              schemaPath: "#/properties/size/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            (c === null ? (c = [e]) : c.push(e), l++);
          }
        }
        if (e.tags !== void 0) {
          let n = e.tags;
          if (Array.isArray(n)) {
            if (n.length < 1) {
              let e = {
                instancePath: t + "/tags",
                schemaPath: "#/properties/tags/minItems",
                keyword: "minItems",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 items",
              };
              (c === null ? (c = [e]) : c.push(e), l++);
            }
            let e = n.length;
            for (let r = 0; r < e; r++) {
              let e = n[r];
              if (typeof e == "string") {
                if (i(e) < 1) {
                  let e = {
                    instancePath: t + "/tags/" + r,
                    schemaPath: "#/properties/tags/items/minLength",
                    keyword: "minLength",
                    params: { limit: 1 },
                    message: "must NOT have fewer than 1 characters",
                  };
                  (c === null ? (c = [e]) : c.push(e), l++);
                }
              } else {
                let e = {
                  instancePath: t + "/tags/" + r,
                  schemaPath: "#/properties/tags/items/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                (c === null ? (c = [e]) : c.push(e), l++);
              }
            }
            let r = n.length,
              a;
            if (r > 1) {
              let e = {};
              for (; r--;) {
                let i = n[r];
                if (typeof i == "string") {
                  if (typeof e[i] == "number") {
                    a = e[i];
                    let n = {
                      instancePath: t + "/tags",
                      schemaPath: "#/properties/tags/uniqueItems",
                      keyword: "uniqueItems",
                      params: {
                        i: r,
                        j: a,
                      },
                      message: "must NOT have duplicate items (items ## " + a + " and " + r + " are identical)",
                    };
                    (c === null ? (c = [n]) : c.push(n), l++);
                    break;
                  }
                  e[i] = r;
                }
              }
            }
          } else {
            let e = {
              instancePath: t + "/tags",
              schemaPath: "#/properties/tags/type",
              keyword: "type",
              params: { type: "array" },
              message: "must be array",
            };
            (c === null ? (c = [e]) : c.push(e), l++);
          }
        }
        if (e.text !== void 0) {
          let n = e.text;
          if (Array.isArray(n)) {
            if (n.length < 1) {
              let e = {
                instancePath: t + "/text",
                schemaPath: "#/properties/text/minItems",
                keyword: "minItems",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 items",
              };
              (c === null ? (c = [e]) : c.push(e), l++);
            }
            let e = n.length;
            for (let r = 0; r < e; r++) {
              let e = n[r];
              if (typeof e == "string") {
                if (i(e) < 1) {
                  let e = {
                    instancePath: t + "/text/" + r,
                    schemaPath: "#/properties/text/items/minLength",
                    keyword: "minLength",
                    params: { limit: 1 },
                    message: "must NOT have fewer than 1 characters",
                  };
                  (c === null ? (c = [e]) : c.push(e), l++);
                }
              } else {
                let e = {
                  instancePath: t + "/text/" + r,
                  schemaPath: "#/properties/text/items/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                (c === null ? (c = [e]) : c.push(e), l++);
              }
            }
          } else {
            let e = {
              instancePath: t + "/text",
              schemaPath: "#/properties/text/type",
              keyword: "type",
              params: { type: "array" },
              message: "must be array",
            };
            (c === null ? (c = [e]) : c.push(e), l++);
          }
        }
        if (e.url !== void 0) {
          let n = e.url;
          if (typeof n == "string") {
            if (i(n) < 1) {
              let e = {
                instancePath: t + "/url",
                schemaPath: "#/properties/url/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
              };
              (c === null ? (c = [e]) : c.push(e), l++);
            }
          } else {
            let e = {
              instancePath: t + "/url",
              schemaPath: "#/properties/url/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            (c === null ? (c = [e]) : c.push(e), l++);
          }
        }
        if (e.urls !== void 0) {
          let n = e.urls;
          if (Array.isArray(n)) {
            if (n.length < 1) {
              let e = {
                instancePath: t + "/urls",
                schemaPath: "#/properties/urls/minItems",
                keyword: "minItems",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 items",
              };
              (c === null ? (c = [e]) : c.push(e), l++);
            }
            let e = n.length;
            for (let r = 0; r < e; r++) {
              let e = n[r];
              if (typeof e == "string") {
                if (i(e) < 1) {
                  let e = {
                    instancePath: t + "/urls/" + r,
                    schemaPath: "#/properties/urls/items/minLength",
                    keyword: "minLength",
                    params: { limit: 1 },
                    message: "must NOT have fewer than 1 characters",
                  };
                  (c === null ? (c = [e]) : c.push(e), l++);
                }
              } else {
                let e = {
                  instancePath: t + "/urls/" + r,
                  schemaPath: "#/properties/urls/items/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                (c === null ? (c = [e]) : c.push(e), l++);
              }
            }
            let r = n.length,
              a;
            if (r > 1) {
              let e = {};
              for (; r--;) {
                let i = n[r];
                if (typeof i == "string") {
                  if (typeof e[i] == "number") {
                    a = e[i];
                    let n = {
                      instancePath: t + "/urls",
                      schemaPath: "#/properties/urls/uniqueItems",
                      keyword: "uniqueItems",
                      params: {
                        i: r,
                        j: a,
                      },
                      message: "must NOT have duplicate items (items ## " + a + " and " + r + " are identical)",
                    };
                    (c === null ? (c = [n]) : c.push(n), l++);
                    break;
                  }
                  e[i] = r;
                }
              }
            }
          } else {
            let e = {
              instancePath: t + "/urls",
              schemaPath: "#/properties/urls/type",
              keyword: "type",
              params: { type: "array" },
              message: "must be array",
            };
            (c === null ? (c = [e]) : c.push(e), l++);
          }
        }
      } else {
        let e = {
          instancePath: t,
          schemaPath: "#/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        (c === null ? (c = [e]) : c.push(e), l++);
      }
      return ((S.errors = c), l === 0);
    }
    S.evaluated = {
      props: !0,
      dynamicProps: !1,
      dynamicItems: !1,
    };
    function C(e, { instancePath: t = "", parentData: n, parentDataProperty: r, rootData: i = e, dynamicAnchors: a = {} } = {}) {
      let d = null,
        f = 0,
        p = C.evaluated;
      if ((p.dynamicProps && (p.props = void 0), p.dynamicItems && (p.items = void 0), e && typeof e == "object" && !Array.isArray(e))) {
        for (let n in e)
          if (!(o.test(n) || s.test(n) || c.test(n) || l.test(n) || u.test(n))) {
            let e = {
              instancePath: t,
              schemaPath: "#/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: n },
              message: "must NOT have additional properties",
            };
            (d === null ? (d = [e]) : d.push(e), f++);
          }
        for (let n in e)
          o.test(n) &&
            (S(e[n], {
              instancePath: t + "/" + n.replace(/~/g, "~0").replace(/\//g, "~1"),
              parentData: e,
              parentDataProperty: n,
              rootData: i,
              dynamicAnchors: a,
            }) ||
              ((d = d === null ? S.errors : d.concat(S.errors)), (f = d.length)));
        for (let n in e)
          if (s.test(n)) {
            let r = e[n];
            if (r && typeof r == "object" && !Array.isArray(r) && r.kind !== void 0) {
              let e = f,
                i = f;
              if (r.kind !== "vignette") {
                let e = {};
                (d === null ? (d = [e]) : d.push(e), f++);
              }
              if (i === f) {
                let e = {
                  instancePath: t + "/" + n.replace(/~/g, "~0").replace(/\//g, "~1") + "/kind",
                  schemaPath: "#/patternProperties/%5E(%3F!vignette-of-death-)/properties/kind/not",
                  keyword: "not",
                  params: {},
                  message: "must NOT be valid",
                };
                (d === null ? (d = [e]) : d.push(e), f++);
              } else ((f = e), d !== null && (e ? (d.length = e) : (d = null)));
            }
          }
        for (let n in e)
          if (c.test(n)) {
            let r = e[n];
            if (r && typeof r == "object" && !Array.isArray(r) && r.kind !== void 0) {
              let e = f,
                i = f;
              if (r.kind !== "set") {
                let e = {};
                (d === null ? (d = [e]) : d.push(e), f++);
              }
              if (i === f) {
                let e = {
                  instancePath: t + "/" + n.replace(/~/g, "~0").replace(/\//g, "~1") + "/kind",
                  schemaPath: "#/patternProperties/%5E(%3F!set-)/properties/kind/not",
                  keyword: "not",
                  params: {},
                  message: "must NOT be valid",
                };
                (d === null ? (d = [e]) : d.push(e), f++);
              } else ((f = e), d !== null && (e ? (d.length = e) : (d = null)));
            }
          }
        for (let n in e)
          if (l.test(n)) {
            let r = e[n];
            if (r && typeof r == "object" && !Array.isArray(r) && r.kind !== void 0) {
              let e = f,
                i = f;
              if (r.kind !== "expansion") {
                let e = {};
                (d === null ? (d = [e]) : d.push(e), f++);
              }
              if (i === f) {
                let e = {
                  instancePath: t + "/" + n.replace(/~/g, "~0").replace(/\//g, "~1") + "/kind",
                  schemaPath: "#/patternProperties/%5E(%3F!expansion-)/properties/kind/not",
                  keyword: "not",
                  params: {},
                  message: "must NOT be valid",
                };
                (d === null ? (d = [e]) : d.push(e), f++);
              } else ((f = e), d !== null && (e ? (d.length = e) : (d = null)));
            }
          }
        for (let n in e)
          if (u.test(n)) {
            let r = e[n];
            if (r && typeof r == "object" && !Array.isArray(r) && r.kind !== void 0) {
              let e = f,
                i = f;
              if (r.kind !== "armor-kit") {
                let e = {};
                (d === null ? (d = [e]) : d.push(e), f++);
              }
              if (i === f) {
                let e = {
                  instancePath: t + "/" + n.replace(/~/g, "~0").replace(/\//g, "~1") + "/kind",
                  schemaPath: "#/patternProperties/%5E(%3F!armor-kit-)/properties/kind/not",
                  keyword: "not",
                  params: {},
                  message: "must NOT be valid",
                };
                (d === null ? (d = [e]) : d.push(e), f++);
              } else ((f = e), d !== null && (e ? (d.length = e) : (d = null)));
            }
          }
      } else {
        let e = {
          instancePath: t,
          schemaPath: "#/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        (d === null ? (d = [e]) : d.push(e), f++);
      }
      return ((C.errors = d), f === 0);
    }
    C.evaluated = {
      props: !0,
      dynamicProps: !1,
      dynamicItems: !1,
    };
    function w(e, { instancePath: t = "", parentData: n, parentDataProperty: r, rootData: i = e, dynamicAnchors: a = {} } = {}) {
      let o = null,
        s = 0,
        c = w.evaluated;
      if ((c.dynamicProps && (c.props = void 0), c.dynamicItems && (c.items = void 0), e && typeof e == "object" && !Array.isArray(e)))
        for (let n in e)
          S(e[n], {
            instancePath: t + "/" + n.replace(/~/g, "~0").replace(/\//g, "~1"),
            parentData: e,
            parentDataProperty: n,
            rootData: i,
            dynamicAnchors: a,
          }) || ((o = o === null ? S.errors : o.concat(S.errors)), (s = o.length));
      else {
        let e = {
          instancePath: t,
          schemaPath: "#/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        (o === null ? (o = [e]) : o.push(e), s++);
      }
      return ((w.errors = o), s === 0);
    }
    w.evaluated = {
      props: !0,
      dynamicProps: !1,
      dynamicItems: !1,
    };
    var T = RegExp("^(?!dice-)", "u"),
      E = RegExp("^(?!shirt-)", "u");
    function D(e, { instancePath: t = "", parentData: n, parentDataProperty: r, rootData: i = e, dynamicAnchors: a = {} } = {}) {
      let s = null,
        c = 0,
        l = D.evaluated;
      if ((l.dynamicProps && (l.props = void 0), l.dynamicItems && (l.items = void 0), e && typeof e == "object" && !Array.isArray(e))) {
        for (let n in e)
          if (!(o.test(n) || T.test(n) || E.test(n))) {
            let e = {
              instancePath: t,
              schemaPath: "#/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: n },
              message: "must NOT have additional properties",
            };
            (s === null ? (s = [e]) : s.push(e), c++);
          }
        for (let n in e)
          o.test(n) &&
            (S(e[n], {
              instancePath: t + "/" + n.replace(/~/g, "~0").replace(/\//g, "~1"),
              parentData: e,
              parentDataProperty: n,
              rootData: i,
              dynamicAnchors: a,
            }) ||
              ((s = s === null ? S.errors : s.concat(S.errors)), (c = s.length)));
        for (let n in e)
          if (T.test(n)) {
            let r = e[n];
            if (r && typeof r == "object" && !Array.isArray(r) && r.accessoryType !== void 0) {
              let e = c,
                i = c;
              if (r.accessoryType !== "dice") {
                let e = {};
                (s === null ? (s = [e]) : s.push(e), c++);
              }
              if (i === c) {
                let e = {
                  instancePath: t + "/" + n.replace(/~/g, "~0").replace(/\//g, "~1") + "/accessoryType",
                  schemaPath: "#/patternProperties/%5E(%3F!dice-)/properties/accessoryType/not",
                  keyword: "not",
                  params: {},
                  message: "must NOT be valid",
                };
                (s === null ? (s = [e]) : s.push(e), c++);
              } else ((c = e), s !== null && (e ? (s.length = e) : (s = null)));
            }
          }
        for (let n in e)
          if (E.test(n)) {
            let r = e[n];
            if (r && typeof r == "object" && !Array.isArray(r) && r.accessoryType !== void 0) {
              let e = c,
                i = c;
              if (r.accessoryType !== "shirt") {
                let e = {};
                (s === null ? (s = [e]) : s.push(e), c++);
              }
              if (i === c) {
                let e = {
                  instancePath: t + "/" + n.replace(/~/g, "~0").replace(/\//g, "~1") + "/accessoryType",
                  schemaPath: "#/patternProperties/%5E(%3F!shirt-)/properties/accessoryType/not",
                  keyword: "not",
                  params: {},
                  message: "must NOT be valid",
                };
                (s === null ? (s = [e]) : s.push(e), c++);
              } else ((c = e), s !== null && (e ? (s.length = e) : (s = null)));
            }
          }
      } else {
        let e = {
          instancePath: t,
          schemaPath: "#/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        (s === null ? (s = [e]) : s.push(e), c++);
      }
      return ((D.errors = s), c === 0);
    }
    D.evaluated = {
      props: !0,
      dynamicProps: !1,
      dynamicItems: !1,
    };
    function O(e, { instancePath: t = "", parentData: n, parentDataProperty: r, rootData: o = e, dynamicAnchors: s = {} } = {}) {
      let c = null,
        l = 0,
        u = O.evaluated;
      if ((u.dynamicProps && (u.props = void 0), u.dynamicItems && (u.items = void 0), e && typeof e == "object" && !Array.isArray(e))) {
        if (e.content === void 0) {
          let e = {
            instancePath: t,
            schemaPath: "#/required",
            keyword: "required",
            params: { missingProperty: "content" },
            message: "must have required property 'content'",
          };
          (c === null ? (c = [e]) : c.push(e), l++);
        }
        if (e["included-only"] === void 0) {
          let e = {
            instancePath: t,
            schemaPath: "#/required",
            keyword: "required",
            params: { missingProperty: "included-only" },
            message: "must have required property 'included-only'",
          };
          (c === null ? (c = [e]) : c.push(e), l++);
        }
        if (e.accessories === void 0) {
          let e = {
            instancePath: t,
            schemaPath: "#/required",
            keyword: "required",
            params: { missingProperty: "accessories" },
            message: "must have required property 'accessories'",
          };
          (c === null ? (c = [e]) : c.push(e), l++);
        }
        if (e.bundles === void 0) {
          let e = {
            instancePath: t,
            schemaPath: "#/required",
            keyword: "required",
            params: { missingProperty: "bundles" },
            message: "must have required property 'bundles'",
          };
          (c === null ? (c = [e]) : c.push(e), l++);
        }
        if (e.homebrew === void 0) {
          let e = {
            instancePath: t,
            schemaPath: "#/required",
            keyword: "required",
            params: { missingProperty: "homebrew" },
            message: "must have required property 'homebrew'",
          };
          (c === null ? (c = [e]) : c.push(e), l++);
        }
        for (let n in e)
          if (
            n !== "$schema" &&
            n !== "shopUpdated" &&
            n !== "content" &&
            n !== "bundles" &&
            n !== "homebrew" &&
            n !== "accessories" &&
            n !== "included-only"
          ) {
            let e = {
              instancePath: t,
              schemaPath: "#/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: n },
              message: "must NOT have additional properties",
            };
            (c === null ? (c = [e]) : c.push(e), l++);
          }
        if (e.$schema !== void 0) {
          let n = e.$schema;
          if (typeof n == "string") {
            if (i(n) < 1) {
              let e = {
                instancePath: t + "/$schema",
                schemaPath: "#/properties/%24schema/minLength",
                keyword: "minLength",
                params: { limit: 1 },
                message: "must NOT have fewer than 1 characters",
              };
              (c === null ? (c = [e]) : c.push(e), l++);
            }
          } else {
            let e = {
              instancePath: t + "/$schema",
              schemaPath: "#/properties/%24schema/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            (c === null ? (c = [e]) : c.push(e), l++);
          }
        }
        if (e.shopUpdated !== void 0) {
          let n = e.shopUpdated;
          if (typeof n == "string") {
            if (!a.test(n)) {
              let e = {
                instancePath: t + "/shopUpdated",
                schemaPath: "#/properties/shopUpdated/pattern",
                keyword: "pattern",
                params: { pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
                message: 'must match pattern "^\\d{4}-\\d{2}-\\d{2}$"',
              };
              (c === null ? (c = [e]) : c.push(e), l++);
            }
          } else {
            let e = {
              instancePath: t + "/shopUpdated",
              schemaPath: "#/properties/shopUpdated/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            (c === null ? (c = [e]) : c.push(e), l++);
          }
        }
        (e.content !== void 0 &&
          (C(e.content, {
            instancePath: t + "/content",
            parentData: e,
            parentDataProperty: "content",
            rootData: o,
            dynamicAnchors: s,
          }) ||
            ((c = c === null ? C.errors : c.concat(C.errors)), (l = c.length))),
          e.bundles !== void 0 &&
            (w(e.bundles, {
              instancePath: t + "/bundles",
              parentData: e,
              parentDataProperty: "bundles",
              rootData: o,
              dynamicAnchors: s,
            }) ||
              ((c = c === null ? w.errors : c.concat(w.errors)), (l = c.length))),
          e.homebrew !== void 0 &&
            (C(e.homebrew, {
              instancePath: t + "/homebrew",
              parentData: e,
              parentDataProperty: "homebrew",
              rootData: o,
              dynamicAnchors: s,
            }) ||
              ((c = c === null ? C.errors : c.concat(C.errors)), (l = c.length))),
          e.accessories !== void 0 &&
            (D(e.accessories, {
              instancePath: t + "/accessories",
              parentData: e,
              parentDataProperty: "accessories",
              rootData: o,
              dynamicAnchors: s,
            }) ||
              ((c = c === null ? D.errors : c.concat(D.errors)), (l = c.length))),
          e["included-only"] !== void 0 &&
            (C(e["included-only"], {
              instancePath: t + "/included-only",
              parentData: e,
              parentDataProperty: "included-only",
              rootData: o,
              dynamicAnchors: s,
            }) ||
              ((c = c === null ? C.errors : c.concat(C.errors)), (l = c.length))));
      } else {
        let e = {
          instancePath: t,
          schemaPath: "#/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        (c === null ? (c = [e]) : c.push(e), l++);
      }
      return ((O.errors = c), l === 0);
    }
    O.evaluated = {
      props: !0,
      dynamicProps: !1,
      dynamicItems: !1,
    };
  });
export default i();
