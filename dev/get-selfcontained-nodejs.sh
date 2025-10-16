#!/bin/bash

if [ ! -d dev/nvm ] ; then
    mkdir -v dev/nvm
fi

export NVM_DIR="$PWD/dev/nvm"


if [ ! -f dev/nvm/nvm.sh ] ; then
    echo "Using 'curl' to draw-down and run v0.40.3 of the nvm bash-based installer"
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
else
    echo "You already have 'nvm.sh' installed"
fi

source dev/nvm/nvm.sh
nvm install --lts


