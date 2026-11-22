import literacyGuide from "./generated/literacy-guide";
export const skill = literacyGuide;
export const teachingContext = {
  enabled: true,
  objective:
    "Geliştiricinin yapılan işi, gerçek kod akışını ve teknik kararları anlayabilmesini sağla.",
  repositoryAccess:
    "Ozear kod depolarını otomatik okumaz. Dosya içeriğini istemcinin yetkili kod araçlarıyla doğrula.",
  skill,
};

// Stable content-derived fingerprint; not a security digest.
let guideHash = 2166136261;
for (const char of skill)
  guideHash = Math.imul(guideHash ^ char.charCodeAt(0), 16777619);
export const guide = {
  version: (guideHash >>> 0).toString(16),
  uri: "ozear://guides/code-literacy",
};
