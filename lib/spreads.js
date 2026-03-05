const spreads = {
  single: {
    name: "Single Card",
    cardCount: 1,
    positions: [
      { label: "The Card", description: "The essence of your question" }
    ]
  },

  threeCard: {
    name: "Past, Present, Future",
    cardCount: 3,
    positions: [
      { label: "Past", description: "What led you to this moment" },
      { label: "Present", description: "Where you stand now" },
      { label: "Future", description: "Where this path is leading" }
    ]
  },

  celticCross: {
    name: "Celtic Cross",
    cardCount: 10,
    positions: [
      { label: "Present", description: "Your current situation" },
      { label: "Challenge", description: "The immediate obstacle" },
      { label: "Foundation", description: "The root cause beneath the surface" },
      { label: "Recent Past", description: "What is just now passing" },
      { label: "Crown", description: "The best possible outcome" },
      { label: "Near Future", description: "What is approaching" },
      { label: "Self", description: "How you see yourself in this" },
      { label: "Environment", description: "How others see you and external influences" },
      { label: "Hopes and Fears", description: "What you desire and what you dread" },
      { label: "Outcome", description: "Where this all leads" }
    ]
  }
};

module.exports = { spreads };
