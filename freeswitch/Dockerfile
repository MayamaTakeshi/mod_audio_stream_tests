FROM mayamatakeshi/freeswitch-dev:1.0.0

RUN <<EOF
echo "Creating lua esl module"
cd /usr/local/src/git/freeswitch/libs/esl/
make luamod
cp lua/ESL.so /usr/local/lib/lua/5.2/ESL.so
EOF

ENV DEBIAN_FRONTEND noninteractive

RUN <<EOF
echo "Installing sudo"
apt-get update
apt-get install -y sudo
apt-get clean
rm -rf /var/lib/apt/lists/*
EOF

run <<EOF
echo "Installing luarocks and json"
cd /usr/local/src/
wget https://luarocks.org/releases/luarocks-3.11.0.tar.gz
tar zxpf luarocks-3.11.0.tar.gz
cd luarocks-3.11.0
./configure && make && make install
luarocks install json-lua 0.1-4 
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


