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

RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
 
RUN . ~/.nvm/nvm.sh && nvm install v21.7.0

RUN . ~/.nvm/nvm.sh && npm install -g yarn

# Adding vim .editorconfig
RUN <<EOF
mkdir -p ~/.vim/pack/local/start
cd ~/.vim/pack/local/start
git clone https://github.com/editorconfig/editorconfig-vim.git
EOF

RUN echo "export PROMPT_DIRTRIM=1" >>  ~/.bashrc

RUN git clone https://github.com/asdf-vm/asdf.git ~/.asdf --branch v0.14.0

RUN echo -e '\n. $HOME/.asdf/asdf.sh' >> ~/.bashrc \
&& echo -e '\n. $HOME/.asdf/completions/asdf.bash' >> ~/.bashrc 


RUN <<EOF
source ~/.asdf/asdf.sh
asdf plugin add golang
asdf install golang 1.22.1
asdf global golang 1.22.1
EOF

