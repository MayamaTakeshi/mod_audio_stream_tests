FROM mayamatakeshi/base-dev-bullseye:1.0.0

# installing dependencies for sip-lab
RUN apt -y install build-essential automake autoconf libtool libspeex-dev libopus-dev libsdl2-dev libavdevice-dev libswscale-dev libv4l-dev libopencore-amrnb-dev libopencore-amrwb-dev libvo-amrwbenc-dev libvo-amrwbenc-dev libboost-dev libtiff-dev libpcap-dev libssl-dev uuid-dev flite-dev cmake

RUN <<EOF
cd /usr/local/src/git
git clone https://github.com/MayamaTakeshi/sngrep
cd sngrep
git checkout mrcp_support
./bootstrap.sh
./configure
make
cp src/sngrep /usr/local/bin/sngrep2
EOF

ENV DEBIAN_FRONTEND noninteractive

RUN <<EOF
echo "Installing sudo"
apt-get update
apt-get install -y sudo
apt-get clean
rm -rf /var/lib/apt/lists/*
EOF

ARG USER_NAME
ARG USER_UID
ARG USER_GID
ARG GIT_USER_NAME
ARG GIT_USER_EMAIL

RUN <<EOF
echo "Creating non-root user"
groupadd --gid $USER_GID $USER_NAME
useradd --uid $USER_UID --gid $USER_GID --create-home --shell /bin/bash $USER_NAME
EOF

RUN <<EOF
echo "Grant sudo privileges to the non-root user"
echo "$USER_NAME ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers
EOF

USER $USER_NAME

RUN <<EOF
if [[ "$GIT_USER_NAME" != "" ]]
then
  git config --global user.name $GIT_USER_NAME
fi
if [[ "$GIT_USER_EMAIL" != "" ]]
then
  git config --global user.email $GIT_USER_EMAIL
fi
EOF

RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
 
RUN . ~/.nvm/nvm.sh && nvm install v21.7.0

RUN . ~/.nvm/nvm.sh && npm install -g yarn

# Adding vim .editorconfig
RUN <<EOF
mkdir -p ~/.vim/pack/local/start
cd ~/.vim/pack/local/start
git clone https://github.com/editorconfig/editorconfig-vim.git
EOF

RUN <<EOF
cat > ~/.config/tmuxinator/dev.yml <<EOF
name: dev
root: ~/

windows:
  - mrcp_server:
    - cd ~/src/mrcp_server
    - node index.js
  - tester:
    - cd ~/tests/functional
  - sngrep2:
    - sudo sngrep2 -d any
EOF
