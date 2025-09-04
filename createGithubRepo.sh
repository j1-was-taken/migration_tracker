#!/bin/bash

# Check if a repository name was provided
if [ -z "$1" ]; then
  echo "Usage: $0 <repository-name>"
  exit 1
fi

REPO_NAME=$1

# Initialize the git repository
git init

# Create a GitHub repository
gh repo create $REPO_NAME --private --source=.

# Set the remote URL
git remote set-url origin git@github.com:j1-was-taken/$REPO_NAME.git

# Add all files to the repository
git add .

# Commit the changes
git commit -m "first commit"

# Rename the branch to main
git branch -M main

# Add the remote origin
git remote add origin git@github.com:j1-was-taken/$REPO_NAME.git

# Push the changes
git push -u origin main
