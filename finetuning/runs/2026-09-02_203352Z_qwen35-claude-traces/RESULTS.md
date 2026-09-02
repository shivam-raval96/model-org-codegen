# 2026-09-02_203352Z_qwen35-claude-traces

- Baseline loss: 1.050942
- Final loss: 0.375210
- Loss change: -0.675732
- Baseline perplexity: 2.8603
- Final perplexity: 1.4553
- Baseline completion-token accuracy: 80.83%
- Final completion-token accuracy: 90.09%
- Training loss: 0.5000
- Training runtime: 914.5 seconds

The held-out loss decreased by 64.3%, perplexity decreased by 49.1%, and
completion-token accuracy increased by 9.26 percentage points. These results
show improved held-out trace imitation; they do not establish improved terminal
task performance or safe behavior.

## Recovery history

- The first worker was stopped before training after detecting that Unsloth's
  import order prevented reliable patching.
- The next submission and its automatic retry failed during preprocessing
  because Qwen3.5 requires typed multimodal text blocks.
- The final resumed submission corrected the message schema, completed all 27
  training steps, and produced the archived adapter and metrics.
