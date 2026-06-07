/**
 * GraphQL fragments shared across Storefront API queries.
 * Import these into route loaders to avoid repeating field sets.
 */

export const IMAGE_FRAGMENT = `#graphql
  fragment Image on Image {
    id
    url
    altText
    width
    height
  }
`;

export const MONEY_FRAGMENT = `#graphql
  fragment MoneyProductItem on MoneyV2 {
    amount
    currencyCode
  }
`;

export const PRODUCT_VARIANT_FRAGMENT = `#graphql
  fragment ProductVariant on ProductVariant {
    id
    availableForSale
    quantityAvailable
    selectedOptions {
      name
      value
    }
    image {
      ...Image
    }
    price {
      ...MoneyProductItem
    }
    compareAtPrice {
      ...MoneyProductItem
    }
    sku
    title
    unitPrice {
      ...MoneyProductItem
    }
    product {
      title
      handle
    }
  }
  ${IMAGE_FRAGMENT}
  ${MONEY_FRAGMENT}
`;

export const PRODUCT_FRAGMENT = `#graphql
  fragment Product on Product {
    id
    title
    vendor
    handle
    description
    descriptionHtml
    options {
      name
      values
    }
    selectedVariant: variantBySelectedOptions(
      selectedOptions: $selectedOptions
      ignoreUnknownOptions: true
      caseInsensitiveMatch: true
    ) {
      ...ProductVariant
    }
    variants(first: 50) {
      nodes {
        ...ProductVariant
      }
    }
    seo {
      description
      title
    }
    images(first: 30) {
      nodes {
        ...Image
      }
    }
    media(first: 30) {
      nodes {
        ... on MediaImage {
          mediaContentType
          image {
            ...Image
          }
        }
        ... on Video {
          mediaContentType
          sources {
            mimeType
            url
          }
        }
      }
    }
  }
  ${PRODUCT_VARIANT_FRAGMENT}
`;

export const CART_FRAGMENT = `#graphql
  fragment CartLine on CartLine {
    id
    quantity
    attributes {
      key
      value
    }
    cost {
      totalAmount {
        ...MoneyProductItem
      }
      amountPerQuantity {
        ...MoneyProductItem
      }
      compareAtAmountPerQuantity {
        ...MoneyProductItem
      }
    }
    merchandise {
      ... on ProductVariant {
        id
        availableForSale
        compareAtPrice {
          ...MoneyProductItem
        }
        price {
          ...MoneyProductItem
        }
        requiresShipping
        title
        image {
          ...Image
        }
        product {
          handle
          title
          id
        }
        selectedOptions {
          name
          value
        }
      }
    }
  }
  ${MONEY_FRAGMENT}
  ${IMAGE_FRAGMENT}

  fragment Cart on Cart {
    id
    checkoutUrl
    totalQuantity
    buyerIdentity {
      countryCode
      customer {
        id
        email
        firstName
        lastName
        displayName
      }
      email
      phone
    }
    lines(first: 100) {
      nodes {
        ...CartLine
      }
    }
    cost {
      subtotalAmount {
        ...MoneyProductItem
      }
      totalAmount {
        ...MoneyProductItem
      }
      totalDutyAmount {
        ...MoneyProductItem
      }
      totalTaxAmount {
        ...MoneyProductItem
      }
    }
    note
    attributes {
      key
      value
    }
    discountCodes {
      code
      applicable
    }
  }
`;

export const COLLECTION_FRAGMENT = `#graphql
  fragment CollectionItem on Collection {
    id
    handle
    title
    description
    image {
      ...Image
    }
    products(first: 50) {
      nodes {
        id
        title
        handle
        availableForSale
        featuredImage {
          ...Image
        }
        priceRange {
          minVariantPrice {
            ...MoneyProductItem
          }
        }
        variants(first: 20) {
          nodes {
            id
            availableForSale
            quantityAvailable
            selectedOptions { name value }
            price { ...MoneyProductItem }
            compareAtPrice { ...MoneyProductItem }
            image { ...Image }
          }
        }
      }
    }
  }
  ${IMAGE_FRAGMENT}
  ${MONEY_FRAGMENT}
`;
