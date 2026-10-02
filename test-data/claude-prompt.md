# Prompt for generating test cases with Claude

Paste everything inside the box into Claude. Change the number of cases on the first line if you want more or fewer.

```text
Generate 10 SYNTHETIC breast cancer test cases for software testing. They must not describe real patients: use made-up IDs SYN-001, SYN-002, and so on, and no names.

For each case give the fields exactly as my app's form expects them:
- Patient ID: SYN-0xx
- Age: whole number, 25–85
- Year of diagnosis: 2022–2026
- Location: "Left breast" or "Right breast"
- Diagnosis: e.g. "Invasive ductal carcinoma (NST)", "Invasive lobular carcinoma", "Invasive carcinoma of no special type"
- Grade: I, II or III, with a Nottingham score that fits (I = 3–5, II = 6–7, III = 8–9)
- ER: Positive / Negative / Unknown, with a percentage if positive
- PR: Positive / Negative / Unknown, with a percentage if positive
- HER2: one of "Negative (IHC 0)", "Low (IHC 1+)", "Equivocal (IHC 2+)", "Positive (IHC 3+)", "Unknown"
- Ki-67 %: a whole number, or "not performed"

Then work out the EXPECTED CLASSIFICATION with these exact rules (St Gallen 2013 surrogate):
- ER/PR count as positive at 1% or more. HER2 Low (1+) counts as negative.
- HER2 Equivocal or Unknown → "Cannot classify yet".
- HER2 Positive + ER or PR positive → "Luminal B (HER2-positive)".
- HER2 Positive + ER and PR negative → "HER2-enriched".
- HER2 negative + ER and PR negative → "Triple-negative".
- HER2 negative + ER or PR positive:
  - PR negative or PR below 20% → "Luminal B (HER2-negative)"
  - else Ki-67 20% or more → "Luminal B (HER2-negative)"
  - else Ki-67 not performed → "Luminal (A or B: needs Ki-67)"
  - else → "Luminal A"

Cover these situations across the set:
- at least one of each: Luminal A, Luminal B (HER2-negative), Luminal B (HER2-positive), HER2-enriched, Triple-negative
- one with Ki-67 not performed
- one HER2 Equivocal (2+)
- one HER2 Low (1+) with ER and PR negative (should be Triple-negative)
- one ER-low case (ER positive at 1–9%)
- one "mismatch" case: the report shows HER2 Positive (IHC 3+), but in the "what to type" table give HER2 as "Negative (IHC 0)" on purpose. Mark it MISMATCH TEST; the app should flag that the file contradicts the entered values.

OUTPUT 1 — a table with the columns: Patient ID | Age | Year | Location | Diagnosis | Grade | Score | ER | ER % | PR | PR % | HER2 | Ki-67 % | Expected classification | Notes
(the values in this table are what I will TYPE into the form)

OUTPUT 2 — the same table as CSV in a code block.

OUTPUT 3 — for EACH case, a realistic histopathology report drawn as a downloadable SVG image (A4 portrait, 1240×1754, white background, black text, Arial):
- red banner at the top: "SYNTHETIC TEST REPORT — NOT A REAL PATIENT"
- "Department of Histopathology", lab number = the Patient ID, age, sex Female, year of diagnosis, specimen (side, core needle biopsy)
- Microscopy paragraph including the Nottingham grade and score
- an Immunohistochemistry table with ER, PR, HER2 and Ki-67 written the way a pathologist would (e.g. "Positive, 80% strong nuclear staining", "Positive (IHC score 3+, complete intense membrane staining)", "Not performed")
- a bold Diagnosis line
- footer: "Fictitious signatory — synthetic document for software testing"
The report must show the TRUE values. For the mismatch case that means the report shows HER2 3+, even though the table tells me to type Negative.
Keep all text inside the page and use no external fonts or images.
```

## Using the output

1. Download each SVG. If your browser can't upload SVG, open it and screenshot it, or convert it to PNG (the app accepts JPG, PNG, WEBP, HEIC and PDF, not SVG).
2. In the app go to **New case**, type the row from the table, choose **Pathology or radiology report** as the file type, and attach the image.
3. Compare the app's **rule-based classification** with the table's "Expected classification". It should match every time. The **AI suggestion** should match too, except on the mismatch case, which should show "File contradicts entered values".

If any rule-based result differs from Claude's expected column, check Claude's arithmetic against the rules before assuming the app is wrong. Language models occasionally misapply cut-offs.
