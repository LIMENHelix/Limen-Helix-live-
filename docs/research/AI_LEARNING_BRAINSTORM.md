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

## ENTRY 002 - (next)
