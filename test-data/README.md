# Test cases

Synthetic pathology reports for testing BreastScan AI. Every file is marked **SYNTHETIC TEST REPORT, NOT A REAL PATIENT** and the patient IDs are invented. Regenerate them with `node scripts/make-test-data.mjs`.

## How to use

1. Sign in (`test@breastscan.local` / `Test-Passw0rd!`) and open **New case**.
2. Type the values from the table below. Leave anything marked "blank" empty.
3. For **File to analyse**, choose **Pathology or radiology report** (not "IHC slide image"), then drag in the file named in the table.
4. Tick the confirmation box and press **Save and analyse**. The result takes about 15–25 seconds.

Fields not in the table can be filled from the report or left empty; they don't affect the classification:

- Age
- Year of diagnosis
- Location
- Grade and score
- Diagnosis

## What to type and what you should see

| File | Patient ID | ER | ER % | PR | PR % | HER2 | Ki-67 % | Rules give | AI should give | Badge |
|---|---|---|---|---|---|---|---|---|---|---|
| TEST-001-report.png | TEST-001 | Positive | 90 | Positive | 60 | Negative (IHC 0) | 10 | Luminal A | Luminal A | AI agrees |
| TEST-002-report.png | TEST-002 | Positive | 30 | Negative | blank | Negative (IHC 0) | blank | Luminal B (HER2-negative) | Luminal B (HER2-negative) | AI agrees |
| TEST-003-report.png | TEST-003 | Positive | 70 | Positive | 20 | Positive (IHC 3+) | 35 | Luminal B (HER2-positive) | Luminal B (HER2-positive) | AI agrees |
| TEST-003-report.pdf | TEST-003B | same as TEST-003 | | | | | | Luminal B (HER2-positive) | Luminal B (HER2-positive) | AI agrees (tests PDF upload) |
| TEST-004-report.png | TEST-004 | Negative | blank | Negative | blank | Positive (IHC 3+) | 40 | HER2-enriched | HER2-enriched | AI agrees |
| TEST-005-report.png | TEST-005 | Negative | blank | Negative | blank | Low (IHC 1+) | 70 | Triple-negative | Triple-negative | AI agrees |
| TEST-006-report.png | TEST-006 | Positive | 80 | Positive | 50 | **Negative (IHC 0)** | 25 | Luminal B (HER2-negative) | Luminal B (HER2-positive) | **AI disagrees** |
| TEST-007-report.png | TEST-007 | Positive | 80 | Positive | 50 | Negative (IHC 0) | blank | Luminal (A or B: needs Ki-67) | Luminal (A or B) | AI agrees |
| TEST-008-unrelated.png | TEST-008 | Positive | 80 | Positive | 50 | Negative (IHC 0) | 10 | Luminal A | Cannot classify yet | Agreement not assessable |

## What each case tests

- **TEST-001 to TEST-005:** one case for each subtype.
- **TEST-003 PDF:** the same case as TEST-003, uploaded as a PDF instead of an image.
- **TEST-005:** HER2-low (1+) counts as HER2-negative.
- **TEST-006, the mismatch test:** the report says HER2 3+, but you deliberately type HER2 Negative. The rules follow what you typed and the AI follows the report, so the case is flagged "AI disagrees" with a warning to re-check the receptor values. This is the most important test.
- **TEST-007:** Ki-67 was not done, so the app asks for it before choosing Luminal A or B.
- **TEST-008:** a shopping list rather than a medical document. The AI should refuse to classify it.

## Form checks you can also try

| Try this | Expected |
|---|---|
| ER set to **Negative** with ER % = 30 | "ER is marked negative but 30% is 1% or more" |
| HER2 set to **Equivocal (2+)** | "Cannot classify yet", with "Missing: HER2 ISH result" |
| Search **Cases** for `test-006` | Finds TEST-006 (search ignores case) |

These results were checked against the real Gemini model (`gemini-3.1-pro-preview`) on 1 Oct 2026. AI wording varies slightly between runs, but the subtypes above should hold.

---

# Real slide images (IHC stains)

The `slides/` folder holds four real breast-cancer immunohistochemistry photos from Wikimedia Commons, published for teaching under open licences (credits below). Each shows **one** stain, and one stain can't give a full subtype on its own. So the test is: leave the marker shown in the image as **Not tested / unknown** on the form, enter the others, and check that the AI reads the missing marker from the slide.

## How to use

1. Go to **New case** and choose **Pathology / IHC slide image** as the file type.
2. Set **Stain shown in this image** to the stain named in the table. This matters: ER, PR and Ki-67 all colour nuclei brown, so the AI must be told which one it is looking at.
3. Type the values below, attach the image, and press **Save and analyse**.

| Image | Stain shown in this image | ER | ER % | PR | PR % | HER2 | Ki-67 % | What the AI should do | Expected result |
|---|---|---|---|---|---|---|---|---|---|
| slides/ER-positive-lobular-carcinoma.jpg | ER | **Unknown** | | Positive | 40 | Negative | 10 | Read ER as positive | AI: Luminal A, agrees |
| slides/PR-positive-61-70-percent.jpg | PR | Positive | 90 | **Unknown** | | Negative | 10 | Read PR as positive, well over 20% | Rules: Luminal (A or B); AI: Luminal A |
| slides/HER2-3plus-strong.jpg | HER2 | Negative | | Negative | | **Unknown** | 40 | Read HER2 as 3+ | Rules: cannot classify; AI: HER2-enriched |
| slides/HER2-positive-invasive.jpg | HER2 | Positive | 80 | Positive | 50 | **Unknown** | 25 | Read HER2 as 3+ | Rules: cannot classify; AI: Luminal B (HER2+) |
| slides/HER2-positive-invasive.jpg | HER2 | Positive | 80 | Positive | 50 | **Negative** (wrong on purpose) | 25 | Spot that the slide shows 3+ | **"File contradicts entered values"** |
| slides/ER-positive-lobular-carcinoma.jpg | ER | **Negative** (wrong on purpose) | | Negative | | Negative | 30 | Spot that the slide shows ER staining | **"File contradicts entered values"** |

These results were checked against `gemini-3.1-pro-preview` on 1 Oct 2026. The AI's percentage estimates are approximate (it read the 61–70% PR slide as ">80%"), so treat them as positive/negative and above/below 20%, not exact figures.

## H&E images (morphology)

H&E slides show tissue structure, not receptors, so the AI will not give a subtype from them. Instead the result page gets a **Morphology from the image** section: whether invasive tumour is present, roughly how much of the image is tumour, the histological type, and the Nottingham components.

From a single image it can usually score tubules and nuclear pleomorphism but not mitoses, which need counting across ten high-power fields. So it shows a grade **range** (for example "Grade II to III, depending on the mitotic count") and flags the grade you entered if it falls outside that range.

To test: choose **Pathology / IHC slide image**, set **Stain shown in this image** to **H&E**, set **Grade** to the value below, leave the receptors as entered (or Unknown), and attach the image.

| Image | Grade to enter | What the AI found when tested |
|---|---|---|
| slides/HE-ductal-carcinoma-high-mag.jpg | Grade I | Invasive carcinoma NST, tubules 3, pleomorphism 3 → **Grade II to III**, so **Grade I is flagged** |
| slides/HE-ductal-carcinoma-tubular-features.jpg | Grade II | Invasive carcinoma NST, **tubules 1** (well-formed tubules), pleomorphism 2 → Grade I to II, so Grade II fits |
| slides/HE-lobular-carcinoma.jpg | Grade II | **Invasive lobular carcinoma** (single-file pattern), tubules 3, pleomorphism 2 → Grade II to III, so Grade II fits |

Scores can shift by one point between runs; the histological type and tumour-present answers are the stable checks.

## Image credits

| File | Source | Author | Licence |
|---|---|---|---|
| ER-positive-lobular-carcinoma.jpg | [Invasive Lobular Carcinoma, Estrogen Receptor](https://commons.wikimedia.org/wiki/File:Invasive_Lobular_Carcinoma,_Estrogen_Receptor_(42352322550).jpg) | Ed Uthman | CC BY 2.0 |
| PR-positive-61-70-percent.jpg | [Immunohistochemistry for progesterone in invasive lobular carcinoma](https://commons.wikimedia.org/wiki/File:Immunohistochemistry_for_progesterone_in_invasive_lobular_carcinoma,_staining_61-70_percent.jpg) | Mikael Häggström, M.D. | CC0 |
| HER2-3plus-strong.jpg | [Her2neu 3+ staining](https://commons.wikimedia.org/wiki/File:Her2neu_3%2Bstaining.jpg) | Marvin 101 | CC BY-SA 4.0 |
| HER2-positive-invasive.jpg | [Positive immunohistochemistry of HER2 in invasive breast cancer](https://commons.wikimedia.org/wiki/File:Positive_immunohistochemistry_of_HER2_in_invasive_breast_cancer.jpg) | Shen S, Xiao G, Du R, Hu N, Xia X, Zhou H | CC BY 3.0 |

| HE-ductal-carcinoma-high-mag.jpg | [Histopathology of invasive ductal carcinoma, high magnification](https://commons.wikimedia.org/wiki/File:Histopathology_of_invasive_ductal_carcinoma,_high_magnification.jpg) | Mikael Häggström, M.D. | CC0 |
| HE-ductal-carcinoma-tubular-features.jpg | [Histopathology of invasive ductal carcinoma with tubular features](https://commons.wikimedia.org/wiki/File:Histopathology_of_invasive_ductal_carcinoma_with_tubular_features.jpg) | Mikael Häggström, M.D. | CC0 |
| HE-lobular-carcinoma.jpg | [Lobular carcinoma - intermed mag](https://commons.wikimedia.org/wiki/File:Lobular_carcinoma_-_intermed_mag.jpg) | Nephron | CC BY-SA 3.0 |

Images are unmodified apart from Wikimedia's own resizing. Keep these credits with the files if you share them.
