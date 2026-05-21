#!/bin/bash
source ~/.bashrc 2>/dev/null
cd /home/centi/Mindflow
cat .k3-prompt-cc-deepseek-worker-1.txt | claude --dangerously-skip-permissions -p 2>&1
