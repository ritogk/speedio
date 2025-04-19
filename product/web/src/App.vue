<script setup lang="ts">
import { RouterView } from 'vue-router'
import { ref } from 'vue'
import { Auth, type CognitoUser } from '@aws-amplify/auth'

// v6系の以降もやる。
// https://tech.route06.co.jp/entry/2024/04/08/122004
Auth.configure({
  region: 'ap-northeast-1',
  userPoolId: 'ap-northeast-1_06J03gwlt',
  userPoolWebClientId: '33an35ja55hq5kk7i1g5ec2hrq',
  endpoint: '', // localstackの場合は変える必要あり
  // USER_SRP_AUTHとUSER_PASSWORD_AUTHの違いは?
  // パスワードなしでログインもできるのか。
  authenticationFlowType: 'USER_SRP_AUTH'
})

const email = ref('')
const password = ref('')
const code = ref('')

const signUp = async (email: string, password: string) => {
  try {
    const result = await Auth.signUp({
      username: email,
      password,
      attributes: {
        email // 必須: Cognitoの属性と一致している必要あり
      }
    })
    console.log('Signup success', result)
    return result
  } catch (err) {
    console.error('Signup error', err)
    throw err
  }
}

const confirm = async (email: string, code: string) => {
  try {
    await Auth.confirmSignUp(email, code)
    alert('確認成功！登録完了しました')
  } catch (err) {
    console.error('確認失敗', err)
  }
}

const singIn = async (email: string, password: string) => {
  try {
    const user = await Auth.signIn(email, password)
    console.log('Sign in success', user)
    alert('サインイン成功')
  } catch (err) {
    console.error('Sign in error', err)
    alert('サインイン失敗')
  }
}

const getUser = async () => {
  try {
    const user = await Auth.currentAuthenticatedUser()
    console.log('Current user:', user)

    const session = await Auth.currentSession()
    const jwt = session.getIdToken().getJwtToken()
    console.log('JWT Token:', jwt)
  } catch (err) {
    console.error('Error getting current user', err)
  }
}

const forgotPassword = async (email: string) => {
  try {
    const result = await Auth.forgotPassword(email)
    console.log('Forgot password result:', result)
  } catch (err) {
    console.error('Error in forgot password', err)
  }
}

const forgotPasswordSubmit = async (email: string, code: string, newPassword: string) => {
  try {
    const result = await Auth.forgotPasswordSubmit(email, code, newPassword)
    console.log('Forgot password submit result:', result)
  } catch (err) {
    console.error('Error in forgot password submit', err)
  }
}

// ユーザー削除
const deleteUser = async () => {
  try {
    const user = await Auth.currentAuthenticatedUser()
    await Auth.deleteUser()
    console.log('User deleted:', user)
  } catch (err) {
    console.error('Error deleting user', err)
  }
}
</script>

<template>
  <p>sample</p>
  <input v-model="email" placeholder="Email" /><br />
  <input v-model="password" type="password" placeholder="Password" /><br />
  <button @click="signUp(email, password)">Sign Up</button><br />
  <button @click="singIn(email, password)">Sign In</button><br />
  <input v-model="code" placeholder="Code" /><br />
  <button @click="confirm(email, code)">Confirm</button><br />
  <button @click="getUser">Get User</button><br />

  <p>パスワードの再設定</p>
  <p>forgotPassword</p>
  <button @click="forgotPassword(email)">Forgot Password</button><br />
  <button @click="forgotPasswordSubmit(email, code, password)">Forgot Password Submit</button><br />

  <p>ユーザー削除</p>
  <button @click="deleteUser">Delete User</button><br />

  <RouterView />
</template>
