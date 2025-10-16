
echo ""
echo "++++"

export NVM_DIR="$PWD/dev/nvm"

if [ ! -d "$NVM_DIR" ] ; then
    echo "! Failed to detect directory:" >&2
    echo "!   '$NVM_DIR'" >&2
    echo "! Have you run ./dev/get-selfcontained-nodejs.sh?" >&2
    echo "" >&2
fi

echo "+ Set NVM_DIR=$NVM_DIR"

source dev/nvm/nvm.sh
echo "+ Local installation of 'nvm' now on PATH"

echo "+ Checking location of NodeJS ('node') on PATH:"
which_output=`which node`


if [ "x$which_output" = "x" ] ; then
    echo "Failed to find NodeJS, to install via 'nvm':"
    echo "  nvm install --lts"
    echo "[version 22 at time of writing]"
    return
else
    echo "+   $which_output"
fi
echo "++++"
echo ""


export YAH_HOME="$PWD"
echo "****"
echo "* Set YAH_HOME"
echo "* Your environment is now set up to run You Are Here"
echo "****"
echo "----"
echo "  npm install"
echo "  npm run dev"
echo "----"


if [ ! -f .env ] ; then
    echo "! Failed to detect .env" >&2
    echo "! Have you created the .env file with your API key?" >&2
else
    google_key_match=`fgrep VITE_GOOGLE_MAPS_API_KEY .env | wc -l`
    if [ $google_key_match = 0 ] ; then
	echo "! Detected .env, but failed to find VITE_GOOGLE_MAPS_API_KEY" >&2
	echo "! Have you added VITE_GOOGLE_MAPS_API_KEY=????......?? to this file?" >&2
    fi
fi

echo ""
