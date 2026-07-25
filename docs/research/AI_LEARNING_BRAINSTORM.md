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

## ENTRY 004 - Does Baum-Welch fit the LIMEN estimator? (verdict: no)

**Date:** 2026-07-25. Read-only check. No code changed.

**Self-correction up front.** An earlier note in this session suggested Baum-Welch "may retire the
stated blocker" on tuning the transition matrix `A`. That was wrong in a way that changes the
decision. Baum-Welch maximizes P(observations | model). The caution at `phase-estimator.js:80-83`
is about tuning `A` against OUTCOMES. Different objectives. An `A` that best explains the channel
readings is not an `A` that best predicts distress. It sidesteps the blocker, it does not retire it.

### What genuinely fits

- **The forward pass IS an HMM forward pass.** `predict()` (`phase-estimator.js:111`) is exactly
  `alpha_t(j) = sum_i alpha_{t-1}(i) * A[i][j]`, and the fusion block (245-254) is the emission
  update. A discrete Bayes filter was written here without being named as one.
- **State identity is pinned, so no label-switching.** Generic HMM fitting suffers from EM finding
  a well-fitting model whose states mean nothing. Here `distressBandLikelihood`
  (`grounded-stress.js:341-350`) is hand-written and phase-labeled, so holding it fixed nails P3 to
  P3. A real advantage over off-the-shelf HMM work.
- **`A` is already 3 parameters, not 110.** `makeTransition()` (line 84) generates the whole matrix
  from STAY/ADV/REG. Tied-parameter EM is standard practice.
- **The observation sequence is partly recoverable.** `limen-worker-snapshot.js:232-234` stores raw
  channel values (cap 300, cadence 60-75 min = 12.5-15.6 days rolling) and the likelihood is a
  deterministic function of the raw value, so `L_1..L_T` can be replayed.

### What breaks it

1. **It is not an HMM, because the emission depends on the filter's own past.** At line 251,
   `w = rc[kk]/totalPrecision`, and `rc` derives from `resVar`, an EWMA of `KL(L_c, belief)` over
   prior ticks (259-266). So the effective emission at time t is a function of the whole belief
   trajectory. Baum-Welch's E-step needs a well-defined joint P(O,S|lambda) to take expectations
   under. There is not one. **This is the disqualifier.**
2. **The pooling is not a likelihood.** Exponents sum to 1, so belief is proportional to
   prior * product of L_c^(w_c), a weighted geometric mean. A conditionally-independent HMM uses
   exponent 1 per channel. The geometric form is a deliberate anti-double-counting choice and it is
   a GOOD one, but it means EM's monotone-likelihood-increase guarantee does not apply.
3. **Stored history is not reliably time-aligned.** Company channels append under `gsShouldAppend`
   (`limen-worker-snapshot.js:227`); `marketScore` and feed channels use
   `gsShouldAppend || !gsSlot.history[key]` (lines 256, 295). That `||` escape fires once at array
   creation and can offset those arrays by one sample permanently. Forward-backward needs aligned
   observation vectors.
4. **Half the latent state is unmodeled.** `stuck` is orthogonal to phase by design (line 20) and is
   computed from belief-shift dynamics. Fitting `A` fits the phase dimension and ignores the one
   that actually carries distress.
5. **Garbage-in risk, already on record.** If the grounded CISS rank is still near-constant across
   domains, EM converges to whatever `A` makes a flat stream likely (probably STAY -> 1) and returns
   a confident, meaningless answer. Re-verify the degeneracy status before fitting anything.

### The useful finding

Work out what a legal version needs: freeze `w`, replay the sequence, constrain the M-step back
onto three parameters. Then notice what is left.

**You are fitting three bounded scalars. EM buys nothing there.**

The entire value of Baum-Welch is searching high-dimensional parameter spaces without enumerating
them. Over STAY/ADV/REG on a bounded grid, brute force is trivially cheap, has no convergence
conditions, no local-optima story, and is auditable by reading a table.

More importantly, **a grid lets you choose the objective.** EM locks you into observation
likelihood. A grid lets you score each candidate `A` against the forward-outcome Brier score from
`outcome-ledger.js`, which is the objective F1/F2 says is missing.

**Placement: this belongs AFTER F1 and F2, not before.** Grid-searching 3 parameters is easy.
Having something meaningful to score them against is the actual work.

---

## ENTRY 005 - Perplexity, entropy, cross-entropy (reference + the LIMEN application)

**Prompted by:** https://youtu.be/Tg9rZt96yyQ
**Title (read off the page shell):** "Perplexity, Entropy & Cross-Entropy in 6 Minutes
(AI Metrics Explained Fast)"
**Captured:** 2026-07-25

**HONESTY ON SOURCING.** YouTube's player metadata is JavaScript-rendered and no caption source was
reachable, so the channel, publish date, duration, and the video's own content could NOT be
extracted. **This entry is not a scrape of that video.** The formulas and limitations below come
from two independent written sources, fetched and cross-checked against each other:
- https://www.topbots.com/perplexity-and-entropy-in-nlp/
- https://www.comet.com/site/blog/perplexity-for-llm-evaluation/

Both agree on every formula stated here. Where they differ in emphasis it is noted.

### The three quantities, and the one relationship that connects them

**Entropy** — the average surprise in a distribution you believe is correct. The floor on how few
bits can encode data drawn from it.

    H(p) = -sum_i p_i * log(p_i)

**Cross-entropy** — the average surprise when the data really comes from `p` but you encode it
using your model `q`. Always at least as large as the true entropy.

    H(p,q) = -sum_i p_i * log(q_i)          and always   H(p,q) >= H(p)

The excess is the KL divergence, which is precisely the price of being wrong:

    KL(p||q) = H(p,q) - H(p)

**Perplexity** — cross-entropy, exponentiated back out of log space.

    PPL = b^H(p,q)      b = 2 for bits, e for nats

### Why perplexity is worth the extra step

It converts an abstract bit-count into an **effective branching factor**: how many equally-likely
options the model is effectively choosing between.

| Cross-entropy (bits) | Perplexity | Reads as |
|---|---|---|
| 1.0 | 2.0 | effectively a coin flip |
| 2.0 | 4.0 | effectively 4 equally-likely options |
| 3.32 | 10.0 | effectively 10 equally-likely options |

"The model is choosing among 4 options" is a sentence a non-technical operator can act on.
"Cross-entropy 2.0" is not. Same number, and the exponential is the entire difference.

### Documented limitations (do not skip these)

1. **Perplexity measures certainty, NOT correctness.** A model can be confidently wrong or
   correctly unconfident, and perplexity cannot tell those apart. This is the single most important
   caveat and it is the exact reason perplexity does not replace a calibration check.
2. **Not comparable across models.** Depends on tokenization, vocabulary size, context length, and
   preprocessing. Cross-model perplexity comparisons are mostly meaningless.
3. **Weak on long-range structure.** Correlates poorly with genuine comprehension.
4. **Gameable by artifacts.** Punctuation and repeated spans lower it without improving anything.
5. **Never sufficient alone.** Must be paired with task-specific measures.

### THE LIMEN APPLICATION (the reason this entry exists)

`phase-estimator.js` emits an 11-element belief vector every tick. Its perplexity is:

    PPL(belief) = exp( -sum_p belief[p] * ln(belief[p]) )

and it is **bounded between 1 and 11 by construction**:

| PPL(belief) | Meaning |
|---|---|
| 1.0 | the estimator is certain: one phase, no ambiguity |
| ~3 | effectively choosing between 3 of the 11 phases |
| 11.0 | uniform: the estimator knows nothing |

**This is the missing confidence measure from Entry 003 / F4, in the form an operator can read.**

Three reasons it beats what is there now:

1. `confidence = totalPrecision / (totalPrecision + informativeCount)` (line 277) measures how much
   evidence ARRIVED. Perplexity measures how concentrated the ANSWER is. Those are different
   things and the code currently uses one as the other.
2. It has units an operator understands. "Energy is effectively choosing between 2.1 phases,
   agriculture between 9.4" is immediately legible. A 0-1 confidence of 0.13 is not.
3. It is the principled version of the `promotedStress` patch (`outcome-ledger.js:44-64`). That bug
   was diffuse belief smearing across 5 of 11 phases and saturating the distress mass. A belief with
   PPL 9.4 is visibly near-uninformative; the current confidence scalar hid that.

**The code is closer to this than it looks.** `kl()` already exists at `phase-estimator.js:61`. And
since `KL(p||q) = H(p,q) - H(p)`, the entropy term is the piece already being implicitly subtracted
in the residual at line 263. Adding `H(belief)` is a few lines against machinery that is already there.

**Objection to my own suggestion.** Limitation #1 above applies with full force: perplexity of the
belief measures how sure the estimator is, and says NOTHING about whether it is right. It would be
a genuine improvement to the display layer and to F4, and it is NOT a substitute for F1/F2. Shipping
a prettier confidence number without the calibration work behind it would make the system more
convincing without making it more correct, which is the wrong direction. Pair it with the Brier
score or do not ship it.

### Where this sits relative to the shortlist

Slots into Entry 003 item #2 (belief entropy) and makes it more valuable than originally scoped:
same three lines of math, but exponentiate at the display layer and the operator gets an effective
phase count instead of a unitless score. Cost is unchanged. Interpretability gain is large.

---

## ENTRY 006 - Entropy and compression, and the label-free test it hands LIMEN

> **STATUS: [mark: IDEA] — PROPOSAL ONLY. NOT BUILT, NOT RUN, NOT VALIDATED.**
>
> Nothing in this entry has been executed against LIMEN data. The compression test described below
> is a DESIGN, not a result. No number in it has been measured. It has not been reviewed by anyone
> other than its author, and it may be wrong in ways section "Objections" does not anticipate.
>
> Two things ARE established and separable from the idea:
>  - **[verified]** Shannon's source coding theorem as stated below, from the cited sources.
>  - **[verified]** the file/line facts about where LIMEN persists channel history.
>
> Everything connecting those two to a conclusion about LIMEN is **[mark: IDEA]**. If any part of
> this is later run, the result belongs in a NEW entry with its own status label. Do not edit this
> entry to look like it was validated. Do not quote its ranking as a finding. Do not present the
> "revised standing" list as a decision; it is one author's opinion about an unrun test.

**Prompted by:** https://youtu.be/FlaJPxP8sd8
**Title (read off the page shell):** "What is Entropy? and its relation to Compression"
**Captured:** 2026-07-25

**SOURCING LIMITS, same as Entry 005.** Channel, date, duration and the video's own content could
NOT be extracted (JS-rendered metadata, no reachable captions, video ID not indexed by search).
**This is not a scrape of that video.** The material below is from:
- https://en.wikipedia.org/wiki/Shannon%27s_source_coding_theorem
- https://en.wikipedia.org/wiki/Entropy_coding
- https://gwlucastrig.github.io/GridfourDocs/notes/EntropyMetricForDataCompression.html

### Shannon's source coding theorem

Entropy is not a metaphor for compressibility. It is the exact, provable floor.

For N i.i.d. draws from a source with entropy H(X):
- **Achievability:** the data can be encoded in slightly more than N*H(X) bits with vanishing loss
  as N grows.
- **Converse:** encoding in fewer than N*H(X) bits makes information loss virtually certain.

For symbol codes over an alphabet of size a:

    H(X)/log2(a)  <=  E[codeword length]  <  H(X)/log2(a) + 1

**This is a mathematical impossibility result, not a statement about current algorithms.** ZIP,
LZ77, Huffman, arithmetic coding, ANS: none beats source entropy on average. Huffman lands within
1 bit per symbol of the bound; arithmetic coding and asymmetric numeral systems get closer by
avoiding the whole-bit granularity.

**The caveat that matters most for LIMEN:** the theorem is stated for i.i.d. sources. For data with
temporal dependence, the marginal entropy OVERSTATES the achievable code length, because a model
that exploits the dependence does better. Kolmogorov complexity is the right frame for the general
case. **That gap is exactly where a model earns its keep.**

### The LIMEN application: a falsifiable test that needs NO outcome labels

This is the most useful thing in this doc so far, so state it precisely.

**The claim under test:** LIMEN's 11-phase latent structure captures real structure in the domain
channel streams.

**The test:** does the 11-state phase model compress a held-out channel stream better than simpler
baselines?

    baseline 0   marginal entropy H(X) of the channel, ignoring time entirely
    baseline 1   first-order Markov chain on the discretised channel value
    model        the 11-state phase model with transition matrix A

Score each by per-sample cross-entropy on **held-out** data. If the phase model does not beat the
baselines, the phase structure is not earning its keep on that domain's data.

**Why this is worth more than it looks:**

1. **It needs no outcome labels.** F1's blocker is that forward outcomes are scarce and slow. This
   test uses only the observation stream, which is already persisted:
   `limen-worker-snapshot.js:232-234`, 300 samples per channel at 60-75 min = 12.5-15.6 days rolling,
   times 20 domains.
2. **It can FALSIFY, which is the point.** Everything else in the audit measures how well the system
   does something. This can show the phase model explains nothing, which is the more valuable answer
   if true, and is the direction the standing research-integrity rule points.
3. **It reuses the Entry 004 machinery.** Observation-likelihood scoring is exactly what Baum-Welch
   would have maximised. Entry 004 concluded that objective is wrong for predicting distress. It is
   the RIGHT objective for this question: does the model explain the data.

### The 5-line diagnostic to run FIRST

Before any of the above, compute the marginal entropy of each channel's stored 300-sample history.

    H(channel) = -sum_v p(v) * ln p(v)          over the observed value histogram
    PPL(channel) = exp(H)                        effective number of distinct states visited

**If H is near zero, the channel carries no information and NO model can be validated against it.**
Any model would "compress" a constant stream perfectly and the comparison would be vacuous.

This is a direct, numeric test of the degeneracy already on record (grounded CISS rank sitting at a
near-constant 0.5042 across all 20 domains, ~70% of channel weight carrying zero information). It
costs one pass over data already in Redis, changes nothing, and either quantifies the problem or
shows it has been fixed. **Run this before anything else in this document.**

### Objections to my own proposal

1. **Compression is not prediction.** A model that explains the observation stream is not thereby a
   model that predicts distress. Same distinction as Entry 004. Passing this test would NOT validate
   any distress claim and must never be reported as if it did.
2. **More parameters compress training data better by construction.** An 11-state model will beat a
   1-state model on data it was fitted to, every time, meaninglessly. Held-out data is mandatory.
   The principled alternative is MDL: total cost = code length of the data + code length of the
   model, which prices the extra parameters explicitly. MDL is the natural frame here since the
   whole discussion is already in bits.
3. **Non-i.i.d. data breaks the clean theorem.** Channel streams are autocorrelated. The marginal
   entropy baseline is therefore a weak baseline, and beating it proves little. Baseline 1 (a
   first-order Markov chain) is the honest bar, because it captures temporal dependence WITHOUT any
   phase structure. If the 11-phase model cannot beat a plain Markov chain on discretised values,
   the phases are decoration.
4. **This could be motivated reasoning.** The compression frame arrived from a video, not from the
   code. The defense is that it produces a test designed to FALSIFY the system's central structural
   claim, which is the opposite of the failure mode. If I had proposed a compression metric that
   the system was likely to pass, that would be the tell.

### Revised standing

The label-free compression test moves ABOVE most of the Entry 003 shortlist, because it is the only
item that can invalidate the architecture rather than improve its measurement. Revised order:

    0.  marginal entropy / perplexity per channel      (5 lines, run today, pure diagnostic)
    1.  Brier / log-loss in outcome-ledger              (Entry 003 F2)
    2.  belief entropy + perplexity display             (Entry 003 F4 + Entry 005)
    3.  held-out compression test vs Markov baseline    (this entry)
    4.  calibration curve / ECE                         (Entry 003 F2 second half)
    ... rest of Entry 003 shortlist unchanged

Item 0 is a measurement on existing data with no code path touched. If item 0 shows the channels are
degenerate, items 1 through 4 are all premature and the real work is upstream in the feeds.

---

## ENTRY 007 - Why cross-entropy and not squared error, and a correction to Entry 003

> **STATUS: [verified] math, [mark: IDEA] application.** The gradient derivation below is standard
> and cited. The recommendation it forces about LIMEN's scoring choice is reasoning, not a
> measured result. Nothing here has been run.

**Prompted by:** https://youtu.be/2Edj6nmSGOQ
**Title (read off the page shell):** "Why Every AI Model is Obsessed with Cross-Entropy"
**Captured:** 2026-07-25

**SOURCING LIMITS.** Third video in a row where channel, date, duration and content could not be
extracted (JS-rendered metadata, no reachable captions). **Not a scrape.** Material from:
- https://susanqq.github.io/tmp_post/2017-09-05-crossentropyvsmes/
- https://medium.com/@gosavipranav123/cross-entropy-vs-mse-understanding-loss-functions-in-classification-a07163cfc46a

Marginal value of this entry is NARROWER than 005 and 006: three of the videos sent so far cover
the same topic cluster, and the doc already had cross-entropy from four angles. **One thing in it
is genuinely new and it contradicts an earlier recommendation, so it is recorded.**

### The actual answer to "why is every model obsessed with cross-entropy"

It is not that cross-entropy is a more accurate measure of error. It is what happens to the
GRADIENT.

**Softmax output with cross-entropy loss.** The derivative of the loss with respect to the logit:

    dL/dz_i = p_i - y_i

That is it. Prediction minus target. No activation-derivative factor anywhere.

**Sigmoid output with squared error.** The chain rule drags the activation derivative in:

    dL/dz = (p - y) * sigma'(z) = (p - y) * p * (1 - p)

**The failure mode:** when the model is CONFIDENTLY WRONG (p near 0 while y = 1), the factor
`p*(1-p)` goes to zero. The gradient vanishes. Learning stalls **exactly in the case where the
model most needs correcting.**

Cross-entropy in the same situation has gradient `p - y = -1`, full strength.

Two more properties that follow:
- **Cross-entropy is the negative log-likelihood of a categorical model.** Minimising it IS maximum
  likelihood estimation. It is not an arbitrary choice of distance.
- **Convexity.** Squared error composed with a sigmoid is non-convex and has a flat region for large
  negative logits. Cross-entropy is convex in the logits, so there is always a gradient pointing
  somewhere useful.

### CORRECTION to Entry 003, finding F2

Entry 003 said: *"Prefer Brier over log loss here. Brier is bounded, and log loss explodes on a
confident miss, which at current sample sizes would let one bad call dominate."*

**That was one-sided and the reasoning above is why.** Brier score IS mean squared error on
probability vectors. So Brier inherits exactly the weakness described above: it under-penalises
confident errors, and its gradient is weakest precisely where the model is most wrong. What Entry
003 framed as Brier's advantage (log loss "exploding") is, for FITTING purposes, log loss's whole
point. The explosion is the signal.

**Refined position, which depends on what the score is FOR:**

| Purpose | Use | Why |
|---|---|---|
| **Reporting** to an operator | **Brier** | bounded [0,1], no infinities, robust at small n, still a proper scoring rule so it cannot be gamed by dishonest probabilities |
| **Fitting** by gradient descent | **Log loss** | gradient stays strong on confident errors; it is the MLE objective |
| **Fitting by grid search** (Entry 004, 3 params) | **either** | enumeration does not use gradients at all, so the saturation argument does not apply |

**Practical consequence for LIMEN:** the Entry 004 conclusion is unaffected. Grid-searching
STAY/ADV/REG over a bounded grid never computes a gradient, so Brier is perfectly fine there. The
correction bites only if channel weights or `precisionHint` are later fitted by gradient descent
(Entry 003 F1/item 6), where log loss should be the objective and Brier the thing shown on the
console.

Cheapest resolution: **compute both.** They are each a handful of lines over the same resolved
pairs, they answer different questions, and disagreement between them is itself informative (it
means confident errors are concentrated somewhere).

### What is NOT new here

For completeness, so a later reader does not mistake this for more than it is: the definition of
cross-entropy, its relation to entropy and KL, and perplexity are all already in Entries 001, 005
and 006. This entry adds only the gradient argument and the correction it forces.

### Note on the source cluster

Three videos supplied so far (`Tg9rZt96yyQ`, `FlaJPxP8sd8`, `2Edj6nmSGOQ`) are all short explainers
on entropy / cross-entropy / perplexity, and none could be scraped directly. The topic is now
covered thoroughly from primary sources. **Further videos in this same cluster are unlikely to add
anything.** The open items in Entry 003 are calibration, proper scoring rules in practice, and
fitting few parameters on thin data, and those are served better by Guo et al. 2017 (temperature
scaling) and by multilevel-modelling material than by more short-form entropy explainers.

---

## ENTRY 008 - Second audit pass: both estimators, the propagator, the Python kernel

> **STATUS: [verified] code facts, [mark: IDEA] anything prescriptive.**
> Every file/line claim below was read directly and can be re-checked. The ranking at the end is
> opinion. Nothing was run, nothing was changed, no code was edited in producing this entry.

**Date:** 2026-07-25. Read-only. Follow-up to Entry 003, which covered only the `lib/` math core.

### Coverage this pass

**Read in full:** `assets/js/phase-estimator.js` (515), `lib/limen-stress-propagator.js` (~700).
**Grepped with context:** `api/helix_app/thing2/phase_engine.py` (label tables + scoring sections).
**Still unread:** 19 of 20 domain brains, `lib/company-phase-scorer.js`, `lib/consolidator.js`,
`lib/bridge-engine.js`, `lib/pattern-author.js`, `limen-helix-api/limen_v4_kernel.js`, and the
~335k-line full repo. The audit still does not cover the system.

---

### 1. CORRECTION: the "two conflicting label registers" reading was wrong

An intermediate read of this session concluded that four files disagreed about the P0-P10 names and
that one register was stale. **That was wrong, and it is recorded here so it does not resurface.**

`phase_engine.py:162-173` carries BOTH registers on the same object:

    "p3":  {"name": "Darkness",   "label": "P3 · INSTABILITY", ...}
    "p8":  {"name": "Conscience", "label": "P8 · PIVOT",       ...}
    "p9":  {"name": "Threshold",  "label": "P9 · COLLAPSE",    ...}

`name` is the INTERPRETIVE register (Darkness, Conscience, Threshold). `label` is the
FINANCIAL-MECHANISM register (Instability, Pivot, Collapse). Every apparent mismatch is one file
reading `name` and another reading `label`. **Deliberate dual naming, not drift.** Withdrawn.

### 2. What survives that correction (two real inconsistencies)

**2a. P1 is genuinely disputed.** `phase_engine.py:162` gives `name: "Rupture"` AND
`label: "P1 · RUPTURE"` — both registers agree P1 is rupture. But `grounded-stress.js:337-338`
places P1 in the CALM band and names it "Light". Not a register mismatch. A disagreement.

**2b. The emission model and the distress readout disagree about what distress is.**
- `grounded-stress.js:344-345` — the rupture likelihood vector puts mass ONLY on {3, 7, 9}.
  Indices 5 and 8 get zero from both the calm and rupture vectors; they receive only the 0.01 floor
  at line 346.
- `outcome-ledger.js:32` — `DISTRESS_PHASES = [3, 5, 7, 8, 9]`, and `distressMass()` sums belief
  over all five.

So P5 and P8 count toward the distress headline while the emission model was never taught to
activate them. **This sharpens Entry 003 F4:** `distressMass` sums over 5 of 11 phases, so a uniform
belief scores ~0.45 before any real signal exists, and two of those five are phases the likelihood
function does not deliberately drive. The `promotedStress` blend (`outcome-ledger.js:59-64`) is
compensating for a band-membership mismatch as well as for diffuseness.

### 3. The two estimators are different algorithms, not two views of one

| | `lib/phase-estimator.js` | `assets/js/phase-estimator.js` |
|---|---|---|
| Method | Bayesian filter, precision-weighted fusion | weighted L1 similarity to attractor vectors |
| Output | belief distribution summing to 1 | 11 scores that do NOT sum to 1 |
| Inputs | kernel-scored companies, market, feeds | browser sim globals (`LIMENObserver`, `LIMENCuriosity`, `LIMENHebbian`, `LIMENMemory`) |
| Abstains | yes, on thin precision (line 237) | no, always names a winner |
| Confidence | `totalPrecision/(totalPrecision+n)` | the raw similarity score itself |

**The browser file does not misrepresent itself.** Its header says heuristic-only, and it renders a
`[HEURISTIC]` chip in the HUD (`assets/js/phase-estimator.js:434-441`). Credit where due.

Two properties are still worth recording:

- **Its `confidence` is not a confidence.** Line 320 sets it to `top.score`, which is
  `sum_i w_i * (1 - |signal_i - target_i|)` (lines 254-268). A similarity, displayed as a percentage.
- **The inertia bonus inflates that number.** Line 288 adds `+0.12` to the previous phase's score
  before the winner is chosen. Because the winner's score IS the displayed confidence, staying put
  mechanically raises the reported percentage by up to 12 points. The stickier the estimate looks,
  the more confident it reads.

### 4. Propagator (`lib/limen-stress-propagator.js`)

**4a. [MOST CONSEQUENTIAL] The kernel's composite is not on a consistent scale across its own
scoring paths.** Lines 356-359 state plainly that paths A and B normalize to roughly 0-3 while
path C can spike to 30-100+. The cap at line 60 (`INTRINSIC_PROPAGATION_CAP = 5.0`) exists because
a CB composite arrived at 107.80 against a p99 of 4.08 (lines 51-60). `pathCAnomaly` flags it.

The containment is well done and the comment is explicit that it contains rather than hides. But the
implication is larger than the cap: intrinsic stress feeds propagation, so two companies with the
same real distress get different propagation weight depending on which path scored them. **This is
a calibration problem INSIDE the kernel, upstream of everything in Entry 003.**

**4b. Accumulation and re-propagation use different rules.** Lines 442-455 add contributions from
the same origin along EVERY path that reaches a node. Lines 457-468 re-propagate onward only along
the shortest path. Induced stress is therefore multi-path while onward radiation is single-path.
Defensible as an exponential-blowup guard; recorded because it is not symmetric and is not
documented as a choice.

**4c. The inhibitory damping is close to inert.** `0.96^n` with a 0.70 floor (lines 80-81, 224-226),
over at most 6 canonical edges, and only when BOTH endpoints are anchored by real overrides rather
than template inheritance. Best case is a 22% reduction; most portals will sit at exactly 1.0. The
comment calls it MVP and that is accurate, but "the system has inhibitory pathways" is currently
closer to true in the data than in the runtime effect.

**4d. A fourth hand-set weight table.** `CATEGORY_WEIGHT` and `CONFIDENCE_MULT` (lines 84-101), plus
`HOP_ATTENUATION`, `ALERT_MULT`, `INTRINSIC_PROPAGATION_CAP`, `INHIBITORY_DAMPING_PER_EDGE`. None
fitted, none with a fitting path. **Entry 003 F1 is wider than reported: four hand-set weight tables
across the stack, not one.**

**4e. Credit.** The determinism work is careful and deliberate: sorted slugs, sorted category keys,
sorted edge lists, sorted Set insertion, each commented as W3 determinism. Reproducibility was
clearly thought about.

### 5. Revised ranking [mark: IDEA]

The new top item is not from any video. It came from reading the propagator.

    0.  Normalize kernel composite across paths A/B/C, or gate path C out of propagation
    1.  Resolve 2b (which phases are distress) and 2a (what P1 is)
    2.  marginal entropy / perplexity per channel        (Entry 006 diagnostic)
    3.  Brier + log loss in outcome-ledger               (Entry 003 F2, as corrected by Entry 007)
    4.  belief entropy + perplexity display              (Entry 003 F4 + Entry 005)
    5.  held-out compression test vs Markov baseline     (Entry 006)
    ... rest of Entry 003 unchanged

**Rationale for item 0 sitting above everything:** calibrating a downstream layer while its input is
un-normalized across three scoring paths is fitting to an artifact. Item 1 is above the measurement
work for the same reason: a distress score whose band membership is disputed between two files
cannot be meaningfully scored against outcomes until the bands agree.

**Objection to my own ranking:** items 0 and 1 are cheap and unglamorous, and neither produces a new
capability. It is possible the path-C anomaly affects so few companies that the cap already handles
it in practice. That is checkable by counting `pathCAnomaly` flags in a live propagation run, which
would be the honest first step rather than assuming the problem is large.

---

## ENTRY 009 - sentdex / NNFS assessment, and the company scorer

> **STATUS: [verified] code facts, [mark: IDEA] anything prescriptive.**
> Read-only. No code was edited. Operator chose **document only, no code** when asked whether
> "build accordingly to the ideas in the document" meant code or document.
>
> **THIS ENTRY CARRIES MAJOR CORRECTIONS TO ENTRY 003.** Section 0 below withdraws one finding and
> reverses another. Read Section 0 before treating anything in Entry 003 as current.

**Date:** 2026-07-25

---

### 0. CORRECTIONS TO ENTRY 003 — one finding withdrawn, one reversed

Directive from the neurologist, correctly: judging a brain rendering for not doing backpropagation
is criticizing it for being a brain. Entry 003 was written from six `lib/` files plus one function
of one domain brain out of twenty, and the learning substrate lives in `assets/js/`. The files were
then read. Results below.

#### 0a. F6 — WITHDRAWN, not revised

F6 said: *"the only learning rule present is Hebbian, and it optimizes nothing."* **False.**

`assets/js/limen-active-inference.js` implements expected free energy explicitly and correctly:
- `updateBeliefs` (lines 78-100) is exact Kalman predict/update on a linear-Gaussian model. For that
  model class Kalman IS variational free-energy minimisation. The header states this and it is right.
- `selectAction` (lines 104-153) computes `G = risk + ambiguity` per action, where
  `risk(mean) = (mean - setpoint)^2 / (2*prefSigma^2)` (pragmatic, line 114) and
  `ambiguity(v) = 0.5*(ln(2*pi*e) + ln v)` (line 115) — **the exact differential entropy of a
  Gaussian**, the epistemic term. Softmin over G selects.

That is textbook active inference with correct formulas, not a gesture at it. There IS an objective
function. F6 was built on a function seen in a grep and never opened. Withdrawn on the record.

`assets/js/limen-plasticity.js` reinforces the withdrawal. Its header states the frame in the code
itself at line 6: **"NOT backprop. No differentiable graph, no weight transport."** The design
choice Entry 003 criticised is documented as deliberate. And the rule is not raw Hebbian:
- **RPE centering** (lines 23-26, 216-236): K4 credit is 0..1 and always positive, so raw it could
  only grow weights. Centered against an EMA baseline, `rpe = credit - baseline`, it becomes an
  ERROR signal. Better-than-usual calibration reinforces; worse weakens.
- **Eligibility traces** (lines 18-22, 181): the truth brake resolves calls 3-20 cycles after
  emission, so the activity that earned the credit is gone when the modulator lands. The trace is
  what stays eligible. That is the biological answer to temporal credit assignment.
- **Prior shrinkage from day one** (lines 29-33, 182): `w <- w + priorLambda*(seed - w)`. The seed
  IS the Bayesian prior; drift from it is the learned posterior shift. Stated in the code.
- **BCM metaplasticity** (lines 65-77, 155-171): eta is not constant. A per-layer threshold theta
  slides with the layer's own activity and eta scales by `(activity - theta)/theta`. Instability
  flags hard-damp it. Self-normalising per layer from its own statistics.

#### 0b. F1 — SUBSTANTIALLY WRONG, narrowed to a fragment

F1 said: *"the outcome ledger generates a training signal that nothing consumes."* Tracing it:

    led.callHitRate + led.resolvedTotal -> window.LIMENK4.credit()   (energy-brain.js:2729-2747)
      -> readModulator -> centered RPE -> applyModulator -> Δw on 8 K-layers
      (all marked WIRED:true at line 2777, self-arming via _learnedVec)

And `energy-brain.js:2723-2728` goes further: `this._externalOutcome`, the feed-resolver's
forecast-vs-realised hit rate, is used as **true reward** once `MIN_EXT_RESOLVED` forecasts resolve,
abstaining to self-consistency below that.

**The loop is closed.** What survives is a fragment: `perChannelHitRateDivergent` specifically still
has no consumer, and `CHANNEL_WEIGHTS` / `precisionHint` in `lib/` are still unfitted.

The "hand-set constants everywhere" complaint also weakens here. eta is BCM-adaptive; seeds are
priors with explicit decay toward them. That is a Bayesian design, not a pile of magic numbers.

#### 0c. F3 and F4 — narrowed

- **F3** ("softmax has no temperature") holds only for `lib/phase-estimator.js`. Temperature exists
  in the system: `limen-active-inference.js:70` defines `tau: 0.05`, used in the softmin at line 139.
- **F4** ("belief entropy computed nowhere") holds only for the 11-phase CATEGORICAL belief.
  `ambiguity()` computes Gaussian belief entropy.

#### 0d. F2 — SURVIVES, and matters MORE than Entry 003 rated it

The `callHitRate` feeding K4 is the binarised hit rate from `outcome-ledger.scorePairs`
(`estimatorCalled === adverseEvent`). So the RPE driving all eight K-layers is centered on a metric
that discards magnitude on both sides and has zero derivative almost everywhere.

**The measurement weakness propagates directly into the learning signal.** Brier or log loss in the
ledger is therefore not a reporting improvement. It changes what the synapses are taught with.

#### 0e. Honest accounting

Of Entry 003's eight findings: **one withdrawn (F6), one substantially wrong (F1), two narrowed
(F3, F4), four intact (F5, F7, F8, and F2 which rises).** Entry 008's kernel path A/B/C scale
problem and Entry 009 §3b's silent registry fallback are untouched by any of this and stand.

Credit where the read found it: the code had already caught a bug in this exact area
(`energy-brain.js:2740-2746`) — keying modulator freshness on the windowed `resolvedSamples` would
saturate near the ledger cap once armed and silently freeze learning; resolved by switching to the
monotonic `resolvedTotal`. That is the class of bug this audit would have hunted for, already found.

---

### 1. Source identification

**Supplied link:** https://youtu.be/Wo5dMEP_BbI
**Title (read off the page shell):** "Neural Networks from Scratch - P.1 Intro and Neuron Code"

That video IS sentdex, so the link and the request to "complete sentdex videos" are one thing: the
**Neural Networks from Scratch** series.

- Author: Harrison Kinsley (sentdex), with Daniel Kukieła on the book
- Channel: active since December 2012, 1M+ subscribers
- Book + companion site: https://nnfs.io/
- Free video series accompanies the book
- Scope: code a neuron, stack layers, activation functions, loss, backpropagation, optimizers, in
  Python and NumPy with no ML libraries

Same sourcing wall as Entries 005 to 007: channel, date and duration are JS-rendered and were not
extractable. Series scope above is from the book/site listings, not from watching.

### 2. Assessment: what transfers to LIMEN and what does not [mark: IDEA]

Applying the same filter Entry 007 applied to the entropy cluster, honestly.

**What transfers (two chapters):**

- **Categorical cross-entropy loss, implemented by hand.** This is Entry 007's gradient argument as
  working code rather than prose. Reading an implementation where `dL/dz = p - y` falls out of the
  algebra is the fastest way to stop treating it as a formula to trust.
- **The optimizer loop.** SGD and its variants. This is the direct cure for Entry 003 F6, where
  LIMEN runs `Δw = η·pre·post·modulator` (Hebbian) against no objective at all. Seeing a loop that
  computes a loss, takes its gradient, and steps, makes the absence in LIMEN concrete.

**What does not transfer, stated correctly this time:**

An earlier draft of this entry said "LIMEN does not need a neural network." **That sentence was
wrong and is retracted.** It was a system-wide architectural verdict reached from six `lib/` files
and one function of one domain brain, and it posed a fork that does not exist. A Bayes filter and a
neural network are not alternatives — deep state-space models, neural HMMs and amortised inference
combine them routinely.

The correct statement is narrower and points the other way:

**LIMEN is a neural computation and needs to be one. What it does not need, and should not have, is
a BACKPROP-TRAINED network.** Backpropagation requires weight transport (the backward pass needs an
exact transposed copy of the forward weights) and non-local error signals. Biological synapses have
neither. This is the weight-transport problem and it has been the central obstacle to biological
plausibility for decades. For a brain rendering, **biological plausibility is the specification,
not a limitation.** A system faithfully reproducing backprop would be LESS brain-like.

What a brain rendering consists of computationally is a third thing with a precise name:
hierarchical **predictive coding** performing approximate Bayesian inference through LOCAL update
rules. Predictive coding has been shown to approximate backprop under specific conditions without
weight transport or non-local errors (Whittington & Bogacz). That is the bridge, and it is what
LIMEN already contains:
- `lib/phase-percept.js` computes precision-weighted prediction error. That IS predictive coding.
- `limen-plasticity.js` is the neo-Hebbian three-factor rule, the correct biological answer to how
  a synapse learns without backprop.
- `limen-active-inference.js` minimises expected free energy (see §0a).

So the NNFS content that does not transfer is specific: dense layers, ReLU, and a softmax classifier
on spiral data trained by backprop. Not "neural networks."

**Verdict.** Two chapters are worth extracting. Watching the full series to get them is a poor trade
against Guo et al. 2017 (temperature scaling), McElreath's partial-pooling lectures, or the
local-learning literature (predictive coding, equilibrium propagation, feedback alignment, target
propagation) which is the material actually adjacent to this architecture.

### 3. `lib/company-phase-scorer.js` (first 200 lines read)

**3a. It is the CONSUMER of the kernel score, not the producer.** Line 42 sets
`SCORE_API_BASE: 'https://limenhelix.com/api/limen/score'` and the file calls it per CIK. So the
path A/B/C scale problem recorded in Entry 008 §4a originates UPSTREAM of this file, inside the
kernel API. **This relocates Entry 008's rank-0 item: the fix belongs in the kernel scorer, not in
the propagator and not here.**

**3b. Silent registry degradation [NEW FINDING].** Line 109:

    var COMPANY_REGISTRY = _loadRegistryFromCommandBoard() || [ ...~100 hardcoded companies... ];

The live registry is 506 CIKs loaded from `command-board-data.json` (lines 79-107, three candidate
paths, each in a try/catch that falls through silently). If none resolve on a cold start, scoring
runs against a stale hardcoded list roughly a fifth the size, **with no flag, no log line, and no
alarm**. Downstream, `grounded-stress.compute()` only abstains below `minScored: 4`, so it would
report `grounded: true` over a fifth of the universe and nothing would indicate the difference.

Cheap mitigation if this is ever built: have the loader record which path resolved (or that it fell
back) and surface it on the snapshot, the same way `massWeighted:false` is surfaced in
`grounded-stress.js`. That pattern already exists in the codebase; it just is not applied here.

**3c. Cadence discrepancy [VERIFY BEFORE TRUSTING].** The scheduler comment at lines 47-49 computes
full coverage as `506/(30+30) ≈ 8.4 ticks × 3 min = 25 min`, assuming a **3-minute** cron. But
`limen-worker-snapshot.js:161-167` describes a **15-minute** worker cron with measured 60-75 minute
effective gaps. If 15 minutes is the live schedule, full company-scoring coverage takes roughly two
hours, not 25 minutes. **I did not read the cron config**, so this is a flagged discrepancy and not
a finding. Resolvable by reading `vercel.json`.

**3d. A fifth hand-set threshold table.** Lines 32-35: `DOMAIN_STRESS_ELEVATED: 0.65`,
`DOMAIN_STRESS_HIGH: 0.70`, `P7A_COUNT_MIN: 2`, `P3_COUNT_MIN: 3`. Entry 003 F1 now spans five
tables: channel weights, K-layer seeds, propagator category/confidence weights, propagator tuning
constants, and these scheduler thresholds.

**3e. Credit.** The comment at lines 37-41 documents a real production outage precisely: using
`process.env.VERCEL_URL` returned a 401 HTML auth page behind Deployment Protection instead of
JSON, producing `Unexpected token '<'` and `totalScored: 0` for **every** company, silently. That
is exactly the kind of failure that should be written down at the call site, and it was.

### 4. Revised ranking [mark: IDEA]

Rebuilt after §0. F6 is gone from the list entirely. F2 rises, because §0d showed the binarised
hit rate is not merely a reporting metric — it is what teaches eight K-layers.

    0.  Normalize the kernel composite across paths A/B/C — IN THE KERNEL API (per §3a),
        not in the propagator. Untouched by the §0 corrections.
    0b. Surface registry-load provenance so a 506 -> ~100 fallback cannot happen silently (§3b)
    1.  Brier + log loss in outcome-ledger    (F2, per §0d — changes the LEARNING signal,
                                               not just the console)
    2.  Resolve which phases are distress (Entry 008 §2b) and what P1 is (§2a)
    3.  marginal entropy / perplexity per channel            (Entry 006 diagnostic)
    4.  categorical belief entropy + perplexity display      (F4 as narrowed by §0c + Entry 005)
    5.  held-out compression test vs Markov baseline         (Entry 006)
    --  F6 REMOVED (withdrawn, §0a)
    --  F1 reduced to: give perChannelHitRateDivergent a consumer; fit CHANNEL_WEIGHTS (§0b)

0b remains cheap and remains above most capability work: it guards against a silent wrong answer.

**What §0 did NOT change.** Rank 0 and 0b are data-integrity problems in the kernel scorer and the
registry loader. No amount of correct learning machinery downstream compensates for composites on
three uncalibrated scales, or for scoring a fifth of the universe without saying so.

### 5. Coverage, and the lesson about how this audit failed

**Read across Entries 003, 008, 009:** the `lib/` math core, both phase estimators, the propagator,
the first 200 lines of the company scorer, `limen-active-inference.js` (full),
`limen-plasticity.js` (full), and the plasticity/active-inference/overlay call sites in
`energy-brain.js`.

**Still unread:** remaining ~400 lines of `company-phase-scorer.js`, 19 of 20 domain brains, the six
overlay modules (`energy-metaplasticity`, `energy-extinction`, `energy-retrograde-throttle`,
`energy-prediction-error-compressor`, `energy-offline-maintenance`, `energy-neuro-substrate`),
`limen-k4-selfconsistency.js`, `consolidator.js`, `bridge-engine.js`, `pattern-author.js`,
`limen-helix-api/limen_v4_kernel.js`, the kernel API scorer, and the ~335k-line full repo.

**The most important unread file is the kernel scorer behind `/api/limen/score`.** Rank 0 lives
there and every downstream number inherits from it.

#### The methodological lesson, recorded because it will recur

Entry 003 audited `lib/` — the server side — and issued verdicts about the system. **The learning
substrate is not in `lib/`.** It is in `assets/js/`, in the client-side domain brains. One function
of one brain out of twenty was read, and an architecture verdict followed.

Two of the errors this produced were not small. F6 asserted an absence that a 165-line file
contradicts outright. F1 asserted an open loop that is closed and traceable in four hops.

The failure mode is specific and repeatable: **naming what is absent is far more dangerous than
describing what is present, because absence can only be established by exhaustive reading, and this
audit was never exhaustive.** Descriptive findings from a partial read (Entry 008's kernel scale
problem, §3b's registry fallback) survived contact with more reading. Every finding phrased as
"LIMEN does not have X" did not.

Standing correction for future passes on this file: from a partial read, report what the code DOES.
Do not report what it lacks.

---

## ENTRY 010 - LSTM gating, the frozen forget gate, and a rank-0 restatement

> **STATUS: [verified] LSTM equations and LIMEN file/line facts. [mark: IDEA] every claim that
> adaptive retention would improve regulation.** Read-only. No code changed. The lambda cadence
> mismatch in §3 is checkable arithmetic; the proposed fix in §4 is not measured.

**Prompted by:** https://youtu.be/YCzL96nL7j0
**Title (read off the page shell):** "Long Short-Term Memory (LSTM), Clearly Explained" (StatQuest)
**Captured:** 2026-07-25

**SOURCING.** Same JS wall as Entries 005-007 and 009: channel, date, duration and content not
extractable, and the web-search backend returned 529 on three attempts. **Not a scrape of the
video.** Equations below are from https://en.wikipedia.org/wiki/Long_short-term_memory.

---

### 1. The one equation that matters

    c_t = f_t ⊙ c_(t-1) + i_t ⊙ c̃_t

A running accumulator whose retention rate `f_t` is **computed from the current input every step**.
The full set:

    f_t = σ(W_f x_t + U_f h_(t-1) + b_f)        forget gate
    i_t = σ(W_i x_t + U_i h_(t-1) + b_i)        input gate
    c̃_t = tanh(W_c x_t + U_c h_(t-1) + b_c)     candidate
    c_t = f_t ⊙ c_(t-1) + i_t ⊙ c̃_t             cell state
    o_t = σ(W_o x_t + U_o h_(t-1) + b_o)        output gate
    h_t = o_t ⊙ tanh(c_t)                       hidden output

The gradient survives long horizons because the cell state's path is gated-additive rather than
repeatedly multiplied by a weight matrix. The forget gate is the whole contribution: a value in
[0,1] per dimension per step deciding what to keep.

### 2. LIMEN has five of these, all with the gate frozen [verified]

| Location | Update | Rate |
|---|---|---|
| `lib/phase-estimator.js:272` | `stuckAcc = λ·prev + (1−λ)·blockage` | λ = 0.93 fixed |
| `lib/phase-estimator.js:265` | `resVar = λ·prev + (1−λ)·residual²` | λ = 0.93 fixed |
| `lib/phase-estimator.js:125,130` | correlation var/cov EWMA | λ = 0.93 fixed |
| `lib/grounded-stress.js:188,193` | correlation var/cov EWMA | λ = 0.93 fixed |
| `assets/js/limen-plasticity.js:181` | `e = traceDecay·e + pre·post` | 0.85 fixed |
| `assets/js/domain-brains/energy-brain.js:1412-1416` | `prior + lr·(obs − prior)` | lr fixed |

Every one has the form `c_t = f·c_(t-1) + i·x_t` with **f and i as constants**. Structurally these
ARE LSTM cell states. The only missing piece is that the gate never opens or closes.

The standing memory note on adaptive cadence already names this problem in the operator's own words:
the **"forget-vs-remember contradiction."** The LSTM forget gate is the canonical solution to it.

### 3. The checkable defect: lambda was imported across sampling frequencies [verified arithmetic]

`lib/grounded-stress.js:62` is honest about provenance: "CISS uses 0.93, fitted to a 5-dim IGARCH on
the demeaned subindices." **That ECB fit was on WEEKLY financial data.**

LIMEN applies the same constant at a measured 60-75 minute cadence
(`handlers/limen-worker-snapshot.js:161-167`).

Effective memory of an EWMA is roughly `1/(1−λ)` samples. At λ=0.93 that is ~14 samples.

    at weekly cadence     14 samples ≈ one quarter
    at 70-minute cadence  14 samples ≈ 16 hours

**The constant was carried over without rescaling for sampling frequency.** Every EWMA in the stack
is therefore remembering on a horizon nobody chose. This is arithmetic, not inference, and it is the
most likely candidate for a regulation formula behaving wrong. Verify before acting: confirm the
live cadence and confirm no caller overrides `EWMA_LAMBDA`.

### 4. Do NOT import an LSTM. Generalize the gate LIMEN already built. [mark: IDEA]

LSTM gates are learned by backpropagation through time. Entry 009 §0 established backprop is off the
table by design, and correctly so for a brain rendering.

**But an adaptive gate that needs no backprop already exists in this codebase.**
`assets/js/limen-plasticity.js:155-171`, the BCM metaplasticity: a threshold theta slides with the
layer's own recent activity, and the effective rate scales by `(activity − theta)/theta`.
Input-dependent, derived from local statistics only, no gradient path.

So the finding is not "LIMEN lacks gating." It is that **the pattern exists in exactly one module
and is hardcoded in the other five.** The generalization is direct:

    f_t   = clamp(1 − sens·(surprise_t − theta_t)/theta_t, f_min, f_max)
    theta_t ← theta_t + alpha·(surprise_t − theta_t)

High surprise relative to the channel's OWN baseline means forget faster. Settled means remember
longer. That is BCM applied to the accumulator instead of to the learning rate, and it dissolves
forget-vs-remember without picking a side. Biologically plausible, local, no backprop.

### 5. Convergence already present: the output gate [verified]

LSTM separates what is remembered from what is exposed: `h_t = o_t ⊙ tanh(c_t)`.

`lib/outcome-ledger.js:59-64` does the same thing. `promotedStress` gates internal `distressMass`
by confidence before display. **An output gate was built here independently, for the same reason.**
The architectural instinct is right; it simply has not been recognised as a general pattern and
applied to the retention side.

---

### 6. RANK-0 RESTATEMENT — correction to Entry 008 §4a and Entry 009 §4

`/api/limen/score` was finally opened (`api/limen.py:214` → `api/helix_app/thing1/limen_backtest.py`).

**`limen_backtest.py:1113`: `composite = max(path_a, path_b, path_c)`**

| Path | Formula (lines 1104-1111) | Range |
|---|---|---|
| A | `2.5·stress_rate + 0.5·max_consec/10 + 0.5·max(max_p3−p3_entry,0) + sustained_bonus` | **unbounded** |
| B | `1.0·stress_rate + 2.0·cash_decline` | **bounded [0,3]** |
| C | rupture score (acute shock) | **unbounded**, 30-100+ observed |

Path A is unbounded because two terms scale with QUARTER COUNT, not distress intensity:
`max_consec/10`, and `sustained_bonus = (max_consec_sustained − 3)·0.20` (line 1099). A company
stressed 40 quarters outscores one stressed 10 quarters at identical intensity. That is a
history-length bias. Path B, capped at 3 because both terms are in [0,1], **structurally cannot win
the max() for any long-history company.**

**Correction.** Entry 008 called this "a calibration problem inside the kernel." Imprecise, and the
precise version changes the fix:

- The **alert** is well-formed. Per-path thresholds (A=1.1, B=1.5, C=1.5 at lines 832-843), each
  path compared to its own, OR'd at line 1119. Sound.
- It is **`composite` as a magnitude** that is not meaningful — and the codebase already says so.
  `lib/thing-formulas.js:54`: *"alert is the validated classification; composite is descriptive."*
- The defect is downstream: `lib/limen-stress-propagator.js:349-351` consumes `composite` as
  intrinsic stress magnitude, multiplies by `ALERT_MULT`, and propagates it. That uses a descriptive
  field as a metric, against the kernel's own documented contract.

The 107.80-against-p99-4.08 outlier is path C firing at ~72x its threshold: correct as a boolean,
meaningless as a magnitude.

**Revised rank 0:** not "normalize the kernel." Either give the propagator a bounded per-path
normalised magnitude, or have it propagate from the alert plus path identity instead of from
`composite`. Smaller and better targeted than Entry 008 proposed.

### 7. Ranking after this entry [mark: IDEA]

    0.  Propagator stops consuming `composite` as a magnitude (§6) — kernel needs no change
    0b. Surface registry-load provenance (Entry 009 §3b)
    1.  Brier + log loss in outcome-ledger (F2 — teaches the K-layers, per Entry 009 §0d)
    2.  Verify the lambda cadence mismatch (§3) — arithmetic, no code change to check
    3.  Resolve which phases are distress (Entry 008 §2b) and what P1 is (§2a)
    4.  marginal entropy / perplexity per channel (Entry 006 diagnostic)
    5.  Generalize the BCM gate to the five frozen accumulators (§4)
    6.  categorical belief entropy + perplexity display (Entry 009 §0c + Entry 005)
    7.  held-out compression test vs Markov baseline (Entry 006)

### 8. Objection to this entry

§4 proposes changing how long five accumulators remember, on the argument that a fixed rate cannot
serve both regimes. **That argument is sound and still does not establish that adaptive retention
would improve anything measurable here.** The honest sequence is item 4 before item 5: measure what
those channels actually carry before changing how long they carry it. If the Entry 006 diagnostic
shows the channels are near-constant, retention length is irrelevant and the real work is upstream
in the feeds.

Second objection, the standing one: the LSTM frame arrived from a video, not from the code. What
protects it is §3 — the lambda mismatch is arithmetic that holds regardless of whether the LSTM
framing is useful, and it was found by checking the constant's provenance against the measured
cadence, not by watching anything.

---

## ENTRY 011 - (next)
