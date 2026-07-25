# AI LEARNING BRAINSTORM (running doc)

Private research + creativity notes for coding and AI advancement.
Firewalled from the public site (`docs/research/` is in `.vercelignore`, line 108).
Repo copy: `docs/research/AI_LEARNING_BRAINSTORM.md`
Desktop copy: `C:\Users\Chris\OneDrive\Desktop\AI_LEARNING_BRAINSTORM.md`

Append new entries at the bottom. Never delete an entry, strike it through instead.

---

## ENTRY 001 - Transformers, the tech behind LLMs (3Blue1Brown, Deep Learning Ch.5)

**Source:** https://www.youtube.com/watch?v=wjZofJX0v4M
**Written lesson (same content, searchable):** https://www.3blue1brown.com/lessons/gpt
**Next chapter (attention):** https://www.3blue1brown.com/lessons/attention
**Chapter after (MLP / fact storage):** https://www.3blue1brown.com/lessons/mlp
**Captured:** 2026-07-25. Notes are my own restatement, not a transcript.

---

### 1. What the letters actually mean

**G-P-T = Generative Pre-trained Transformer.**

- **Generative:** it produces new text rather than classifying existing text.
- **Pre-trained:** the bulk of its ability came from one enormous, general training run on a huge corpus. "Pre" implies there is a second, smaller stage afterward (fine-tuning, RLHF) that specializes it.
- **Transformer:** the actual architecture. This is the load-bearing word. The same architecture also drives image generators, speech-to-text, and translation. Text prediction is just the most famous application.

The transformer was introduced by Google in 2017 for translation. Everything since (ChatGPT, Claude, image models, Whisper) is a variation on that one paper's idea.

---

### 2. The whole system is one loop: predict, sample, repeat

This is the single most important structural fact, and it is much dumber than it looks from outside.

```
input text
   -> model outputs a probability distribution over EVERY possible next token
   -> sample one token from that distribution
   -> append it to the input text
   -> feed the whole thing back in
   -> repeat
```

That is it. A chatbot is this loop wrapped around a seed prompt that describes a helpful assistant having a conversation. The "personality" is a prompt; the intelligence is in the distribution.

**Insight worth keeping:** the model never plans a sentence. It only ever answers "what token comes next, given everything so far." Coherence over a paragraph is an emergent property of doing that extremely well, not a feature that was built in.

**Why this matters for building things:** any time you want an LLM to do something structured, you are really trying to shape a next-token distribution. Prompting, tool schemas, JSON mode, grammars, all of them are constraints on that one distribution. There is no other lever.

---

### 3. The pipeline inside the box

Text goes in, a probability distribution comes out. In between:

1. **Tokenize.** Split the input into tokens. For text these are roughly words or word-pieces (and punctuation, and whitespace). For images they would be patches; for audio, chunks of the waveform.

2. **Embed.** Each token becomes a vector via a lookup table. This is a pure dictionary lookup at this stage, nothing clever.

3. **Attention blocks.** Vectors talk to each other and update themselves based on context. This is where "machine" in "machine learning model" gets disambiguated from "machine" in "washing machine."

4. **Multilayer perceptron (feed-forward) blocks.** Every vector gets the same transformation applied to it, independently and in parallel. No cross-talk here. Chapter 7 argues this is where factual knowledge is stored.

5. **Alternate 3 and 4 many times.** GPT-3 does this 96 times.

6. **Unembed the last vector.** Only the final vector in the sequence is used to make the prediction. It has, by that point, absorbed context from the entire input.

7. **Softmax.** Turn the raw numbers into a probability distribution.

**The recurring design constraint:** every operation must be a matrix multiplication or something equally parallelizable on a GPU. That constraint is not an implementation detail, it is why the architecture looks the way it does. Attention exists in this form because it can be expressed as batched matrix multiplies. RNNs lost to transformers largely because they could not be parallelized across sequence positions.

---

### 4. Weights vs data (the mental split that makes it click)

A model has two kinds of numbers flowing through it and they should never be confused:

- **Weights (parameters).** Learned during training. Frozen at inference. These are the model. GPT-3 has 175,181,291,520 of them, organized into roughly 27,938 matrices across 8 categories.
- **Activations (the data being processed).** Your specific input, transformed step by step. Different for every request.

Weights are the recipe, activations are the meal. The same weights process every prompt.

Practical consequence: the weights are what you download when you get an open model, the activations are what fills your GPU memory at runtime and scales with context length. Two different cost curves.

---

### 5. Embeddings: meaning as direction, not location

The embedding matrix `W_E` has one column per token in the vocabulary.

**GPT-3 numbers:**
| Thing | Value |
|---|---|
| Vocabulary size | 50,257 |
| Embedding dimension | 12,288 |
| `W_E` parameter count | 50,257 x 12,288 = **617,558,016** |

Those columns start random and are learned during training.

**The key result:** after training, *directions* in this 12,288-dimensional space carry semantic meaning. Not just "similar words are near each other," but "the offset between two words is itself a meaningful vector you can reuse."

Classic demonstrations:
- `woman - man` lands very close to `queen - king`. So there is a "gender" direction.
- `Italy - Germany + Hitler` lands near `Mussolini`. A "country of origin" direction plus a "leader" concept.
- `sushi - Japan + Germany` lands near `bratwurst`. A "national food" direction.

**Dot product as the measuring tool.** The dot product of two vectors is large and positive when they point the same way, zero when perpendicular, negative when opposed. So you can *test* whether a direction encodes what you think:

Take `plur = cats - cat`. Dot it against the embeddings of `one`, `two`, `three`, `four`. The values increase. The direction is genuinely tracking plurality/quantity, not coincidence.

**This is a technique, not a trivia fact.** It is how you interrogate any embedding space you build: propose a direction as a difference of two known examples, then score other items against it. If the ordering matches your intuition, the direction is real.

**Dimensionality intuition:** 12,288 dimensions is far more room than it sounds. If you require vectors to be exactly perpendicular, an N-dimensional space holds only N of them. But if you relax to "roughly perpendicular" (say 89 to 91 degrees), the number of vectors you can pack grows *exponentially* with N (Johnson-Lindenstrauss). This is why high-dimensional spaces can store vastly more independent concepts than their dimension count suggests, and it is the mechanical reason superposition works in interpretability research.

---

### 6. Context: the embedding is only a starting point

The initial embedding of a token encodes only that token, with no context. `bank` gets one vector whether the sentence is about rivers or money.

As the vector passes through attention blocks, it absorbs meaning from its neighbors. By the final layer, the vector sitting at a position is no longer "the word bank," it is "a rich representation of everything relevant in this context, aimed at predicting what comes next."

**Context window:** GPT-3's was 2,048 tokens. Anything past that simply cannot influence the prediction. This is the hard reason long conversations "forget," and why the attention chapter's O(n^2) cost matters commercially.

---

### 7. Unembedding and softmax

**Unembedding matrix `W_U`:** maps the final 12,288-dim vector back to one number per vocabulary token.

| Thing | Value |
|---|---|
| Shape | 50,257 rows x 12,288 columns |
| Parameter count | **617,558,016** |

Note it is a separate set of weights from `W_E`, not the transpose, despite the matching shape. (Some models do tie them; GPT-3 counts them separately.)

Output is 50,257 raw numbers. They are not probabilities: they can be negative, and they do not sum to 1. These raw numbers are called **logits**.

**Softmax** fixes that:
1. Raise `e` to the power of each logit (everything becomes positive).
2. Sum them all.
3. Divide each by the sum.

Result: all values in [0,1], summing to 1. The largest input gets the largest probability, and the transform preserves ordering. It is a "soft" argmax: instead of picking the max outright, it gives the max most of the weight but leaves some for the rest.

**Temperature `T`.** Divide every logit by `T` before exponentiating.

| T | Effect |
|---|---|
| T -> 0 | All weight collapses onto the single highest logit. Deterministic, repetitive, cliche. |
| T = 1 | The raw learned distribution. |
| T > 1 | Flattens the distribution. More weight to unlikely tokens. More surprising, less coherent, eventually incoherent. |

The demo: prompt a model with a story opening and generate at T=0 vs T=1.5. At 0 you get the most predictable, derivative continuation possible. At 1.5 you get originality and mistakes in the same breath.

**Important caveat:** T is not a real physical temperature and there is nothing principled about T > 1. It just reshapes the curve. Most APIs cap it around 2 because beyond that it is noise. The name comes from an analogy with the Boltzmann distribution in thermodynamics, where the same formula describes how energy states populate at a given temperature.

**Why "logits":** borrowed from statistics (log-odds). Not worth over-thinking. Treat "logits" as "the raw pre-softmax scores."

---

### 8. The full GPT-3 parameter budget

Chapter 5 tallies embedding + unembedding (about 1.2B of 175B) and defers the rest. Filling in the rest from chapters 6 and 7, since the arithmetic is what makes the architecture concrete:

| Component | Shape | Count |
|---|---|---|
| Embedding `W_E` | 12,288 x 50,257 | 617,558,016 |
| Unembedding `W_U` | 50,257 x 12,288 | 617,558,016 |
| Key `W_K` (per head) | 128 x 12,288 | 1,572,864 |
| Query `W_Q` (per head) | 128 x 12,288 | 1,572,864 |
| Value down `W_V-down` (per head) | 128 x 12,288 | 1,572,864 |
| Value up `W_V-up` (per head) | 12,288 x 128 | 1,572,864 |
| **Attention, all 96 heads x 96 layers** | | **57,982,058,496** |
| MLP up-projection (per layer) | 49,152 x 12,288 | 603,979,776 |
| MLP down-projection (per layer) | 12,288 x 49,152 | 603,979,776 |
| **MLP, all 96 layers** | | **115,964,116,992** |
| **TOTAL** | | **175,181,291,520** |

**The number that surprises people:** the MLP blocks hold about two thirds of the parameters (116B vs 58B). Attention gets all the attention, but most of the model's storage is in the feed-forward layers. That is the basis for the "facts live in the MLPs" line of interpretability research.

Other GPT-3 constants worth memorizing: 96 layers, 96 attention heads per layer, head dimension 128 (note 96 x 128 = 12,288 exactly, so the heads tile the embedding space), MLP hidden width 4x the embedding dimension.

---

### 9. Attention, in one paragraph (the ch.6 preview this video ends on)

Each vector emits a **query** ("what am I looking for?"), a **key** ("what do I offer?"), and a **value** ("here is the update I would contribute"). Dot every query against every key to get a grid of relevance scores, softmax each column so the weights sum to 1, then take a weighted sum of the value vectors and add it to the embedding. Mask the upper triangle (set to negative infinity before softmax) so a token can never see the future, which is what lets the model train on every position in a sequence simultaneously instead of once per example. Run 96 of these in parallel per layer with different learned matrices, so different heads can specialize (one on adjective-noun agreement, one on coreference, one on syntax). Full detail in chapter 6.

The classic example: in "a fluffy blue creature roamed the verdant forest," the nouns need to pull in the adjectives that modify them. Attention is the mechanism that lets `creature` update itself to mean "fluffy blue creature."

---

## BRAINSTORM: what to actually do with this

Ranked by learning-per-hour, not by impressiveness.

### Tier 1: cheap, high return, do these first

1. **Build the direction test in 30 lines.** Grab any open embedding set (GloVe, or `all-MiniLM-L6-v2` via sentence-transformers, or OpenAI/Voyage embeddings). Compute `plur = embed("cats") - embed("cat")`. Score `one/two/three/four/many/single` against it. Then invent your own directions: `formality = embed("hello") - embed("hey")`, `risk = embed("bankrupt") - embed("solvent")`. This is the single fastest way to stop treating embeddings as a black box.

2. **Watch temperature break a model live.** Same prompt, T = 0, 0.7, 1.0, 1.4, 1.9. Ten runs each. Watch where coherence dies. You will develop a real intuition for which of your tasks want low T (extraction, classification, code) and which want high T (naming, brainstorming, variation). Right now most people pick 0.7 because it is the default.

3. **Tokenize things and look at the damage.** Run text through a tokenizer viewer. Numbers, rare names, code, and non-English all tokenize badly. This explains a whole class of "why is the model bad at this" complaints (arithmetic, character counting, rhyming) without any deep theory.

### Tier 2: real builds

4. **Write a next-token loop by hand against a small local model.** Not a chat API call, the actual loop: get logits, apply temperature, sample, append, repeat. Once you have written it, "the model is just predicting the next token" stops being a slogan and becomes something you have debugged.

5. **Karpathy's `nanoGPT` / "Let's build GPT from scratch."** The natural companion to this video. 3Blue1Brown gives you the geometry; Karpathy gives you the code. About 2 hours, and you end with a working transformer you typed yourself.
   https://www.youtube.com/watch?v=kCc8FmEb1nY

6. **Build an embedding-space map of something you own.** Take a corpus that matters to you, embed every item, reduce to 2D (UMAP), and plot. The clusters that appear are the ones the model thinks exist. Compare to the ones you think exist. The gaps are the interesting part.

### Tier 3: connections to LIMEN, flagged as speculative

These are idea seeds, not build orders. Nothing here is validated and several of them are probably wrong.

7. **"Meaning is direction, not location" as a domain-signal frame.** LIMEN currently scores domain stress as scalars. The embedding lesson says the useful structure is often in the *difference between two states*, not in either state's absolute position. Worth testing whether a domain's `now - baseline` vector, treated as a direction and scored against reference directions (a "supply shock" direction built from two known historical periods, say), separates better than the scalar does. Cheap to falsify: if the direction scores are just a monotone function of the scalar, there is no new information and it dies.

8. **Temperature as an explicit exploration knob.** Softmax-with-temperature is the same math as a Boltzmann policy in reinforcement learning. Anywhere the system currently picks the top-ranked option, there is a T=0 assumption hiding. Making T explicit and tunable per surface is a small change that names an assumption nobody has been making on purpose.

9. **The MLP-vs-attention split as an architecture lesson.** Attention = routing, MLP = storage, and storage is 2x bigger. If a system is all routing and no storage, it can relate things it already knows but cannot know much. Worth asking, honestly, which side of that line LIMEN's node graph sits on.

10. **Superposition as a warning about interpretability.** High-dimensional spaces store far more concepts than dimensions by using nearly-orthogonal directions. That means concepts are *not* cleanly separated into individual neurons, and any system that claims "this component means X" is probably reading a superposition. Directly relevant to any claim that a particular node or channel in LIMEN "represents" a particular real-world factor.

### Follow-on watching, in order
- 3B1B Ch.1-4 (neural network basics, gradient descent, backprop) if the matrix intuition is shaky: https://www.3blue1brown.com/topics/neural-networks
- 3B1B Ch.6, attention: https://www.3blue1brown.com/lessons/attention
- 3B1B Ch.7, how LLMs might store facts: https://www.3blue1brown.com/lessons/mlp
- Karpathy, "Let's build GPT from scratch": https://www.youtube.com/watch?v=kCc8FmEb1nY
- The original paper, "Attention Is All You Need" (2017): https://arxiv.org/abs/1706.03762

---

### Open questions to chase later
- If attention is O(n^2) in context length, what do the long-context models (1M tokens) actually do differently? (Sparse attention, sliding windows, linear attention, state-space models like Mamba.)
- Where does RLHF / instruction tuning fit? Ch.5 covers only pre-training. The gap between "predicts internet text" and "acts like an assistant" is entirely in the second stage and this video does not touch it.
- Positional encoding is skipped in ch.5. Attention as described is order-blind, so something must inject position. (RoPE is the current standard.)
- Mixture-of-Experts: if MLPs hold most of the parameters, MoE is the obvious move (only activate a fraction per token). Confirm how the parameter math changes.

---

## ENTRY 002 - Full 3Blue1Brown library index (175 lessons)

**Channel:** https://www.youtube.com/@3blue1brown
**Site:** https://www.3blue1brown.com
**Captured:** 2026-07-25
**Author:** Grant Sanderson

### How this was obtained, and what is verified

The YouTube channel page and the site's topic pages are JavaScript-rendered, so they return
nothing useful to a scraper. The complete list came from the site's own sitemap
(`https://www.3blue1brown.com/sitemap.xml`), which enumerates every lesson page.

Note: their sitemap is published with a `localhost:37359` base URL, a build bug on their end.
The paths are correct. Every URL below is `https://www.3blue1brown.com/lessons/<slug>`.

- **VERIFIED:** all 175 slugs and URLs (straight from the sitemap). Titles, publish dates, and
  content notes for the 13 lessons in the AI/ML core section below (each page fetched individually).
- **NOT VERIFIED:** titles in the full index are shorthand I derived from the slug, not official
  titles. Use them to navigate, not to quote.
- **Caveat:** this is the library as the *site* lists it. The YouTube channel additionally carries
  shorts, livestreams, and re-uploads that never got a lesson page. Also, a handful of entries
  below are talks, announcements, or contest-results pages rather than teaching videos
  (`some1`, `some2`, `some3-results`, `tedx-talk`, `harvey-mudd-speech`, `spheres-talk`,
  `transformers-talk`, `lockdown-math-announcement`, `qa3`, `qa4`).

---

### A. THE AI / ML CORE (fetched and verified, read these first)

This is the whole reason to care about this channel for our purposes. Seven-chapter arc plus
four adjacent pieces.

| # | Title | Published | Slug |
|---|---|---|---|
| Ch.1 | But what is a Neural Network? | 2017-10-05 | `neural-networks` |
| Ch.2 | Gradient Descent, How Neural Networks Learn | 2017-10-16 | `gradient-descent` |
| Ch.3 | What is backpropagation really doing? | 2017-11-03 | `backpropagation` |
| Ch.4 | Backpropagation Calculus | 2017-11-03 | `backpropagation-calculus` |
| Ch.5 | Transformers, the tech behind LLMs | 2024-04 | `gpt` |
| Ch.6 | Attention in transformers, step-by-step | 2024 | `attention` |
| Ch.7 | How might LLMs store facts | 2024-08-31 | `mlp` |

Plus:

| Title | Published | Slug |
|---|---|---|
| Large Language Models explained briefly | 2024-11-20 | `mini-llm` |
| Reinventing Entropy \| Compression & Intelligence Pt.1 | 2026-06-07 | `entropy` |
| But what is Cross-Entropy? \| Compression is Intelligence Pt.2 | 2026-07-16 | `cross-entropy` |
| But how do AI images and videos actually work? (guest: Welch Labs) | 2025-07-25 | `diffusion-models` |
| But what is a convolution? | 2022-11-18 | `convolutions` |
| Analyzing our neural network (appendix to Ch.1) | 2017 | `neural-network-analysis` |

#### Substance worth carrying out of each

**Ch.1 `neural-networks`.** The MNIST digit classifier as the worked example. Architecture: 784
input neurons (28x28 pixels), two hidden layers of 16 neurons, 10 outputs. **13,002 total weights
and biases.** A neuron holds an activation in [0,1]; it computes a weighted sum of the previous
layer plus a bias, then squashes with sigmoid. The whole layer is `sigma(W a + b)`, one matrix
multiply. The aspirational story is hierarchical feature detection (pixels to edges to loops to
digits). Note that Ch.1 sells this story and the appendix (`neural-network-analysis`) then admits
the trained network does not actually do that. That honesty is the most valuable part.

Modern note the lesson makes: ReLU replaced sigmoid in practice because it trains far better.

**Ch.2 `gradient-descent`.** Cost = sum of squared differences between actual and desired output
activations, averaged over training examples. The 13,002 parameters become one column vector; the
cost is a function from 13,002 dimensions to 1. The gradient points in the direction of steepest
increase, so you step along `-eta * grad(C)`. Two ideas that pay off forever: (a) the gradient's
*magnitudes* tell you which parameters matter most, not just which direction to move; (b) the cost
function must be smooth for any of this to work, which is why activations are continuous rather
than binary.

**Ch.3 `backpropagation`.** Backprop is just an efficient algorithm for computing that gradient.
Three ways to raise a neuron's activation: change its bias, change its incoming weights (most
effective on connections from already-bright neurons, which is literally Hebbian "fire together,
wire together"), or change the previous layer's activations (which you cannot do directly, so you
record it as a request and pass it back). Every output neuron sends competing requests backward;
you sum them and recurse.

**Stochastic gradient descent:** rather than averaging over the whole dataset per step, shuffle and
use mini-batches of roughly 100. Each step is a worse estimate of the true gradient but you take
vastly more of them. This is the drunk-man-stumbling-downhill-fast tradeoff, and it is why every
training loop you will ever write has a `batch_size`.

**Ch.4 `backpropagation-calculus`.** The chain rule made concrete. For the simplest chain,
`C0 = (a[L] - y)^2`, the sensitivity of cost to a weight decomposes into three factors:
- `dz[L]/dw[L] = a[L-1]` (a weight's influence scales with the activation feeding it)
- `da[L]/dz[L] = sigma'(z[L])`
- `dC0/da[L] = 2(a[L] - y)`

The bias case is identical except the first factor is 1. The multi-neuron case adds an index and a
sum over downstream paths. **If you understand nothing else, understand that a weight's gradient is
proportional to the activation on its input side.** That single fact explains dead neurons,
vanishing gradients, why initialization scale matters, and why normalization layers exist.

**Ch.5 `gpt`.** Covered in full in Entry 001 above.

**Ch.6 `attention`.** Query, key, value. Each token emits a query ("what am I looking for?") and a
key ("what do I offer?"). Dot every query against every key to build a relevance grid, softmax down
each column, then use those weights to sum value vectors and add the result to the embedding.

GPT-3 numbers: key/query space is 128-dimensional, so `W_Q` and `W_K` are each 128 x 12,288 =
**1,572,864 parameters per head.** The value map is factored into a down-projection and an
up-projection (128 x 12,288 and 12,288 x 128) rather than one 12,288 x 12,288 matrix, which is a
low-rank trick that keeps the parameter count matched to the other three. 96 heads per block, 96
blocks. That is ~600M parameters per attention block and ~58B total.

**Masking:** entries where a token would attend to a *later* token are set to negative infinity
before the softmax, which zeroes them. This is not a safety feature, it is a training efficiency
feature: it lets a single sequence serve as many training examples at once, one per position.

**Cost:** the attention pattern is O(n^2) in context length. That is the entire reason long context
is expensive and the entire reason the field keeps inventing alternatives.

**Ch.7 `mlp`.** The chapter that reframes everything. Structure per block: up-projection, add bias,
ReLU, down-projection, add bias. Vectors do **not** talk to each other here; the same operation
runs on each position in parallel.

GPT-3 numbers: embedding 12,288 wide, MLP hidden layer **49,152 neurons** (4x), so the up and down
projections are ~604M parameters each, ~1.2B per block, ~116B total. **The MLPs are about
two-thirds of the entire model.**

The interpretation offered: the up-projection's rows each ask a yes/no question of the vector (a
dot product against some learned direction, plus a bias threshold). ReLU turns that into an AND
gate. The down-projection's columns are then "what to add to the residual stream if that neuron
fired." So a row might ask "does this vector encode Michael Jordan?" and the matching column adds
the basketball direction.

**Superposition, and why it matters far beyond this video.** In `n` dimensions you can fit only `n`
exactly perpendicular vectors. But if you relax to *nearly* perpendicular (say 85 to 95 degrees),
the number you can pack grows exponentially with `n`. In GPT-3's 12,288 dimensions that is on the
order of **40 billion** near-orthogonal directions. Consequence: individual neurons do not
correspond to individual concepts. Features are smeared across many neurons and many features share
each neuron. Any claim of the form "this unit represents X" is almost certainly reading a
superposition. This is the mathematical basis for sparse-autoencoder interpretability work, and it
is a direct warning about over-interpreting any single channel in any system we build.

**`mini-llm`.** The 7-minute version of the whole story, for someone who will never watch 3 hours.
Useful framings: training data scale for GPT-3 is on the order of what a human would take 2,600+
years of nonstop reading to consume; training compute is well over 100 million years of operations
at a billion ops per second. Also the clearest short statement that **pre-training makes a text
predictor, and RLHF is a separate stage that turns it into an assistant.** Ch.5 skips that entirely.

**`entropy` and `cross-entropy` (2026, the newest material).** Framed as "Compression &
Intelligence." Entropy is the floor on how few bits can encode data drawn from a known
distribution. Cross-entropy is what it costs when your model of the probabilities is *wrong*:
`H(p,q) = -sum p(x) log q(x)`. The excess over true entropy is the KL divergence, the price of your
error.

**Why this pair is the most underrated thing on the list:** cross-entropy is the loss function LLMs
are actually trained on. Every chapter above describes the architecture; this pair describes the
objective. And the framing "compression is intelligence" is the direct line to why next-token
prediction produces general capability at all: to compress text optimally you must model the
process that generated it, which means modeling the world.

**`diffusion-models`** (guest, Welch Labs). Iterative denoising plus CLIP to bridge text and image.
The counterpart to the whole transformer arc for the image/video side.

**`convolutions`.** Discrete convolution as one operation appearing in three places: probability
(distribution of a sum of random variables), image processing (blur, edge detection kernels), and
polynomial multiplication. Then the payoff: convolution in one domain is pointwise multiplication in
the frequency domain, so the FFT turns an O(n^2) convolution into O(n log n). Direct sequel:
`convolutions2` (the FFT-based fast multiplication), `image-convolution`, `gaussian-convolution`.

---

### B. COMPLETE INDEX, all 175 lessons

Grouping is mine. Slugs are verified; labels are slug-derived shorthand, not official titles.
URL pattern: `https://www.3blue1brown.com/lessons/<slug>`

**Neural networks / AI (13)** - see section A above
`neural-networks` · `gradient-descent` · `backpropagation` · `backpropagation-calculus` ·
`neural-network-analysis` · `gpt` · `attention` · `mlp` · `mini-llm` · `transformers-talk` ·
`diffusion-models` · `entropy` · `cross-entropy`

**Essence of Linear Algebra (16)** - the single best prerequisite series for ML
`eola-preview` · `vectors` · `span` · `linear-transformations` · `matrix-multiplication` ·
`3d-transformations` · `determinant` · `inverse-matrices` · `nonsquare-matrices` · `dot-products` ·
`cross-products` · `cross-products-extended` · `change-of-basis` · `eigenvalues` ·
`abstract-vector-spaces` · `quick-eigen`

**Essence of Calculus (15)**
`essence-of-calculus` · `derivatives` · `derivatives-power-rule` · `chain-rule-and-product-rule` ·
`eulers-number` · `implicit-differentiation` · `limits` · `epsilon-delta` · `integration` ·
`area-and-slope` · `higher-order-derivatives` · `taylor-series` · `taylor-series-geometric-view` ·
`l-hopitals-rule` · `derivatives-trig-functions`

**Differential equations (9)**
`differential-equations` · `pdes` · `heat-equation` · `diffusion-equation` · `laplace-transform` ·
`laplace-for-odes` · `matrix-exponents` · `divergence-and-curl` · `derivatives-and-transforms`

**Fourier / signal processing (7)**
`fourier-transforms` · `fourier-series` · `fourier-series-montage` · `discrete-fourier-transform` ·
`convolutions` · `convolutions2` · `image-convolution`

**Probability & statistics (11)**
`bayes-theorem` · `bayes-theorem-quick` · `better-bayes` · `binomial-distributions` · `pdfs` ·
`clt` · `gaussian-integral` · `gaussian-convolution` · `bertrands-paradox` · `hyperdarts` ·
`epidemic-simulations`

**Computer science / cryptography / algorithms (12)**
`binary-counting` · `hamming-codes` · `hamming-codes-2` · `bitcoin` · `256-bit-security` ·
`grover` · `grover-clarification` · `seam-carving` · `wordle` · `wordle-2` · `alpha-geometry` ·
`dp3t`

**Physics (16)**
`clacks` · `clacks-solution` · `clacks-via-light` · `colliding-blocks-v2` · `brachistochrone` ·
`snells-law` · `light-quantum-mechanics` · `uncertainty-principle` · `turbulence` ·
`feynmans-lost-lecture` · `barber-pole-1` · `barber-pole-2` · `prism` ·
`refractive-index-questions` · `holograms` · `phase-change`

**Astronomy (2)**
`cosmic-distance-1` · `cosmic-distance-2`

**Geometry / topology / 3D rotation (18)**
`quaternions` · `quaternions-and-3d-rotation` ·
`inscribed-rectangle-problem` · `inscribed-rect-v2` · `borsuk-ulam` · `hairy-ball` · `sphere-area` ·
`one-more-dim` · `higher-dimensions` · `shadows` · `dandelin-spheres` · `windmills` ·
`three-utilities` · `eulers-characteristic-formula` · `incomplete-cubes` · `euclid` ·
`print-gallery` · `spheres-talk`

**Number theory & series (13)**
`zeta` · `basel-problem` · `wallis-product` · `leibniz-formula` · `prime-spirals` ·
`prime-number-race` · `pythagorean-triples` · `borwein` · `moser` · `moser-reboot` ·
`hardest-problem` · `pi-was-628` · `winding-numbers`

**Complex analysis / Euler's formula (8)**
`eulers-formula-old` · `eulers-formula-poem` · `eulers-formula-dynamically` ·
`eulers-formula-via-group-theory` · `complex-exponents` · `holomorphic-dynamics` ·
`newtons-fractal` · `triangle-of-power`

**Group theory / other algebra (2)**
`groups-and-monsters` · `cramers-rule`

**Fractals (3)**
`fractal-dimension` · `hilbert-curve` · `hanoi-and-sierpinski`

**Puzzles (5)**
`chessboard-puzzle` · `subsets-puzzle` · `visual-proofs` · `music-and-measure-theory` ·
`exponential-and-epidemics`

**Lockdown Math, 2020 livestream series (11)**
`lockdown-math-announcement` · `ldm-quadratic` · `ldm-logarithms` · `ldm-natural-logs` ·
`ldm-trigonometry` · `ldm-complex-numbers` · `ldm-eulers-formula` · `ldm-i-to-i` ·
`ldm-imaginary-interest` · `ldm-power-towers` · `ldm-tips-to-problem-solving`

**Meta: talks, teaching philosophy, community (14)**
`inventing-math` · `tattoos-on-math` · `tedx-talk` · `harvey-mudd-speech` · `ego-and-math` ·
`pedagogical-curse` · `manim-demo` · `qa3` · `qa4` · `some1` · `some1-results` · `some2` ·
`some2-results` · `some3-results`

---

### C. Recommended order for AI/coding purposes

If the goal is understanding modern AI rather than general math enrichment, most of the 175 is
optional. The efficient path:

**Tier 1, non-negotiable (about 5 hours):**
1. Essence of Linear Algebra, `eola-preview` through `eigenvalues`. Everything in ML is matrices.
   If `change-of-basis` and `eigenvalues` are not intuitive, nothing downstream will be.
2. Neural Networks Ch.1 to Ch.4. Backprop is the only learning algorithm in play.
3. Ch.5 to Ch.7 (transformers, attention, MLPs). Already summarized in Entry 001 and section A.

**Tier 2, the objective function (about 1 hour):**
4. `entropy` then `cross-entropy`. What the model is actually minimizing. Newest material,
   published 2026, and the one most people have not watched.
5. `mini-llm` for the RLHF piece that Ch.5 omits.

**Tier 3, adjacent and genuinely useful:**
6. `convolutions` + `convolutions2` (CNNs, FFT, and the O(n log n) trick).
7. `bayes-theorem` + `better-bayes` (evidence updating, directly applicable to any scoring system).
8. `clt` + `gaussian-integral` (why normal distributions are everywhere, and what a
   standard deviation actually buys you).
9. `hamming-codes` (error correction; also just an unusually beautiful piece of engineering).
10. `diffusion-models` for the image/video side.
11. `grover` if quantum ever becomes relevant. Currently it does not.

**Skip unless curious:** physics, astronomy, geometry, number theory, Lockdown Math, puzzles.
Excellent, not on the critical path.

---

### D. Brainstorm additions from the full-library view

11. **`manim` is the tool behind every one of these animations, and it is open source Python.**
    https://github.com/3b1b/manim (Grant's own) and https://www.manim.community (the maintained
    community fork; use this one). Direct application: any LIMEN concept that is currently a wall
    of text or a static diagram could be a 60-second animation. The phase arc P0 to P10, the
    stress-fusion pipeline, the four-layer architecture. This is the highest-leverage item on this
    page for explaining the system to a non-technical audience, and it costs nothing but time.
    Caveat before getting excited: manim is slow to author. Budget hours per minute of output.

12. **The Ch.1-to-appendix arc is a model for honest reporting.** Ch.1 teaches the appealing
    hierarchical-features story. `neural-network-analysis` then shows the trained network does not
    do that. He shipped the correction as part of the curriculum rather than quietly leaving the
    nice story standing. Worth copying: when a LIMEN component turns out not to work the way the
    documentation says, the fix is an appended correction, not an edited claim.

13. **"Compression is intelligence" as a lens on what we are building.** If intelligence is
    modeling a generating process well enough to compress its output, then the honest test of any
    LIMEN domain model is: does it compress that domain's data stream better than a naive baseline?
    That is a measurable, falsifiable question, and cross-entropy against a baseline is the exact
    metric. Much sharper than "does the stress score look right." Flagged as an idea, not a plan.

14. **Superposition as a hard constraint on interpretability claims.** Repeating from section A
    because it matters: near-orthogonal packing means high-dimensional representations do not have
    one-concept-per-dimension. If any part of the system claims a specific channel "means"
    something, that claim needs evidence beyond the name we gave it.

15. **SoME (Summer of Math Exposition)** is Grant's annual contest for explanatory content:
    `some1`, `some2`, `some3-results`. The winners are a curated list of the best explanations of
    hard technical ideas made by amateurs. Useful as a study set if the goal is learning to
    *explain* technical systems, which is most of what selling one requires.

---

## ENTRY 003 - Audit: applying the 3B1B material to the LIMEN codebase

**Date:** 2026-07-25
**Type:** READ-ONLY audit. No code was changed. This entry is a report, not a build order.
**Question asked:** what in the author's material would push the existing code beyond its
current state?

### Coverage, stated rather than implied

| Repo | Code files | Lines |
|---|---|---|
| `C:\Users\Chris\Limen-Helix-live-` | 1,322 | 370,196 |
| `C:\Users\Chris\Limen-Helix` (full source) | 1,073 | 334,940 |

**Read in full** (live repo): `lib/phase-estimator.js` (315), `lib/grounded-stress.js` (393),
`lib/outcome-ledger.js` (232), `lib/phase-percept.js` (130), `lib/feed-resolver.js` (102),
`lib/thing-formulas.js` (89). Plus the plasticity and K-stack regions of
`assets/js/domain-brains/energy-brain.js`.

**Grepped, not read:** everything else in both repos, for every relevant math signature
(`softmax`, `crossEntropy`, `brier`, `log_loss`, `eigen`, `backprop`, `temperature`, `entropy`,
`calibrat`, `learningRate`, `precisionHint`, `CHANNEL_WEIGHTS`).

**Result of the full-repo grep:** every hit was in `assets/data/**` JSON payloads. No math code.
So the entire mathematical core of the system is roughly 1,300 lines across six files in the live
repo's `lib/`. The 705k combined line count overstates the size of the surface these findings touch.

**Not verified:** I did not read the ~335k lines of the full repo, and nothing below rests on it.

---

### HEADLINE

There is a learning substrate and there is an outcome substrate. Both are built and both run
every cycle. **They are not connected to each other.**

`lib/outcome-ledger.js:23-24` states it directly: "This module GENERATES that data; it does not
yet consume it."

Every finding below is a variation on that one fact.

---

### F1 — The training signal is produced and then discarded

`lib/outcome-ledger.js:183` computes `perChannelHitRateDivergent`, and its own inline comment
calls it "the re-weighting signal." Repo-wide grep: **nothing reads it.**

Meanwhile the things it would feed are all hardcoded:
- `lib/grounded-stress.js:60` — `CHANNEL_WEIGHTS = { distress: 0.45, unison: 0.30, granularity: 0.25 }`.
  An `opts.weights` override exists (line 227) and no caller ever passes it.
- `precisionHint` (`lib/phase-estimator.js:213`) is the file's own "preferred, independent"
  precision path. Grep: set only in `lib/phase-adapter-human.js` from a hand-written reliability
  table, and in test scripts. The domain adapter `grounded-stress.toBundle()` (line 357) never
  sets it at all, so every domain channel falls back to self-consistency precision — which
  `phase-estimator.js:288` itself flags as "[mark: prior] correlated-channel groupthink risk."

The loop is open at both ends: nothing writes the weights, nothing reads the signal that would.

### F2 — The scoring binarizes before it measures, which destroys the gradient

The direct hit from the newest author material (`entropy` + `cross-entropy`, 2026).

`lib/outcome-ledger.js:152-154`:
```js
var adverseEvent    = p.adverse >= adverseThreshold;
var estimatorCalled = f.beliefDistress >= callThreshold;
var hit = (estimatorCalled === adverseEvent) ? 1 : 0;
```

The estimator emits an 11-way distribution plus a confidence. Both sides collapse to one bit
before anything is scored. Two consequences:

1. A forecast of 0.41 and one of 0.99 score **identically**. So do 0.39 and 0.01.
2. Hit rate is piecewise-constant in the weights, so its derivative is **zero almost everywhere**.
   Even given the will to tune `CHANNEL_WEIGHTS` against it, there is no direction to move in.
   You are reduced to grid search over a step function.

Cross-entropy (and Brier, `(p-y)^2`) are *proper scoring rules*: minimized only by honest
probabilities, and differentiable, so they yield a per-weight direction. This is 3B1B Ch.2-4
applied to a system that currently has no objective function at all.

**Prefer Brier over log loss here.** Brier is bounded; log loss explodes on a confident miss, and
at current sample sizes one bad call would dominate the metric.

**The other half of the same gap:** `skillMetrics` (`outcome-ledger.js:199`) measures
*discrimination* only — precision, recall, F1, base rate. Grep-confirmed: there is **no
calibration measure anywhere in `lib/`**. No reliability curve, no ECE. A model can have strong
recall and be systematically overconfident, and nothing in the codebase would surface it.

### F3 — `softmax` has no temperature, and `confidence` is not derived from the belief

`lib/phase-estimator.js:46` — `softmax(logv)`, no `T` parameter.

The fusion step at lines 251-252:
```js
var w = rc[kk] / totalPrecision;
logpost[p] += w * Math.log(L[kk][p] + EPS);
```
Weights sum to 1, so this is a **geometric mean** of channel likelihoods, not a product. That is a
deliberate anti-double-counting choice and it is defensible. But it makes the fused belief
systematically **flatter** than a true posterior, and nothing in the code accounts for that.

Then line 277: `confidence = totalPrecision / (totalPrecision + informativeCount)`. That measures
*how much evidence arrived*, not *how concentrated the answer is*. The code uses one as the other.

**Cheapest high-value change in this audit:** divide `logpost` by a scalar `T` before the softmax,
then fit `T` on held-out outcome data against the calibration curve. One parameter, standard
method (temperature scaling / Platt), no architecture change, and it is the smallest possible
first use of data already being collected.

### F4 — The `promotedStress` bug is a missing entropy term

`lib/outcome-ledger.js:44-49` documents a real production failure from 2026-07-24: a diffuse
belief spread across 5 of the 11 phases saturated `distressMass` near 1.0, so agriculture and
finance (confidence ~0.13, CISS ~0.25) displayed 0.98 distress, **above** energy at 0.80.
Uncertainty was being rendered as maximum distress.

The fix at lines 59-64 blends the mass against a CISS floor in proportion to confidence. It works.
It is also a patch over a missing quantity: the thing being reached for is the **entropy of the
belief**. Grep-confirmed: Shannon entropy of the belief is computed **nowhere** in `lib/`.
`kl()` exists (`phase-estimator.js:61`); `H()` does not.

`1 - H(belief)/log(11)` is the direct measure of "how concentrated is this answer," it is three
lines, and it would turn the ad hoc ratio at line 277 into a derived quantity.

### F5 — The cited construct is one eigendecomposition away, and the matrix already exists

`lib/grounded-stress.js:114-125` cites the Kritzman/Li/Page/Rigobon **absorption ratio**, then
implements a Herfindahl of the phase histogram instead, with the comment "in the only form the
available data supports."

The absorption ratio is *defined* as the variance share carried by the top eigenvectors of the
correlation matrix. `updateCorrelation()` (line 181) **already builds that matrix.** It is 3x3.
A closed-form eigendecomposition of a 3x3 symmetric matrix gives the actual cited construct
instead of a proxy for it.

Honest limit: with only three channels the absorption ratio is coarse and should not be oversold.
But the file says the data does not support it, and the data does.

### F6 — The only learning rule present is Hebbian, and it is explicitly fed a non-reward

`assets/js/domain-brains/energy-brain.js:2782-2784` runs three-factor plasticity:
`Δw = η·pre·post·modulator`, with eligibility traces.

That is biologically motivated. It is **not gradient descent on any objective** — a Hebbian rule
has no loss function, so there is no sense in which those weights are provably improving at
anything measurable.

And the modulator is explicitly not an outcome. `energy-brain.js:1468-1473`: energy "is NOT
externalRewardEligible: it has no external realized-outcome label, so externalOutcome is ALWAYS
null and its credit is self-consistency calibration only (interpretive), NEVER reward."

So the learning rule is driven by the system's agreement with itself, while an independent
forward-outcome signal sits unconsumed two modules away. The circular-inference cut that was
applied at the diagnosis layer has not been applied at the learning layer.

### F7 — Attention is the right shape for propagation, but it is downstream, not a shortcut

`lib/limen-stress-propagator.js` (32KB, the largest math file) and cross-domain propagation is
gated pending weight validation. Q/K/V attention is structurally the right answer to "which domain
should influence which," and masking plus softmax normalization are already familiar from the
estimator.

**Argument against building it next:** attention's relevance matrix has to be *learned*, from the
same outcome data F1 says nothing consumes. Built before the outcome loop closes, it is a 20x20
hand-set weight matrix wearing a better name. This is item 7, not item 1.

### F8 — If the transition matrix is ever fitted, fit 3 numbers and not 110

`lib/phase-estimator.js:80-83` — the 11x11 transition matrix `A` is a stated prior carrying an
explicit instruction not to tune it against outcomes until a labeled benchmark exists. That
discipline is correct and should stay.

For whenever that changes: `A` has 110 free parameters and there is an overfit wall on record.
But `makeTransition()` (line 84) generates the entire matrix from **three scalars** (`STAY`,
`ADV`, `REG`). Three parameters are tractable on far less data than 110. That is the version that
could actually work.

---

### Ranked shortlist

| # | Change | Effort | Why |
|---|---|---|---|
| 1 | Brier / log-loss alongside `hitRate` in `outcome-ledger.scorePairs` | Small | First differentiable objective in the system. Everything else depends on it. |
| 2 | Belief entropy; derive `confidence` from it | Small | Fixes the root cause that `promotedStress` currently patches. |
| 3 | Temperature scalar on `softmax`, fit on held-out outcomes | Small | One parameter, standard method, first real use of collected data. |
| 4 | Reliability curve / ECE beside `skillMetrics` | Small | Overconfidence is currently undetectable. |
| 5 | Eigendecompose the 3x3 `C` for a true absorption ratio | Small | Delivers the construct the file already cites. |
| 6 | Feed `perChannelHitRateDivergent` into `precisionHint` | Medium | Closes the loop. Gated on #1 and on enough resolved forecasts. |
| 7 | Attention-shaped cross-domain propagation | Large | Only after #6. |

Items 1-5 are all small, all inside `lib/`, and none require new data, new infrastructure, or a
paid API call. They are measurement changes, not capability changes.

### Strongest objection to this audit

Items 1-5 make the system **more legible, not more capable.** None will make a dashboard number
look better. Item 1 will most likely reveal that the estimator is worse-calibrated than the
current hit rate implies. That is the point of doing it, but it should be expected going in rather
than discovered as a nasty surprise.

A second objection worth recording: this audit reads the author's material as a source of
*methods*, and there is a real risk of method-shopping — reaching for cross-entropy because it was
just watched rather than because the problem demanded it. The defense is that F1 (an open loop) was
found by reading the code, not by reading the videos. The videos supplied the fix, not the
diagnosis. If F1 were not true, F2 through F4 would be solutions in search of a problem.

---

## ENTRY 004 - (next)
