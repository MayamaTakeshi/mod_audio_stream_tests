FROM mayamatakeshi/freeswitch-dev:1.0.0

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

