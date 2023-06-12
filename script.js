const drone = new ScaleDrone('OOgX7u3om3pEfCPf');

// Nome da sala deve ser precedido de 'observable-'
const roomName = 'observable-nildopontes';
const configuration = {
   iceServers: [{
      urls: 'stun:stun.voipstunt.com'
   }]
};
var showLog = false;
var remoteVideo, allVideo;
var room;
var pc = [new RTCPeerConnection(configuration), new RTCPeerConnection(configuration), new RTCPeerConnection(configuration)];
document.addEventListener("DOMContentLoaded", function() {
   onLog('Documento carregado');
   remoteVideo = [remoteVideo1, remoteVideo2, remoteVideo3];
   allVideo = [localVideo, remoteVideo1, remoteVideo2, remoteVideo3];
   if(location.search == '?log'){
      showLog = true;
      log.style.display = 'initial';
   }
});
var clients = [{id: ''}, {id: ''}, {id: ''}];

navigator.mediaDevices.getUserMedia({audio: true, video: true,}).then(stream => {
   localVideo.srcObject = stream;
   localVideo.style.transform = 'scaleX(-1)';
   setVideoLayout();
   // Anexa o fluxo de vídeo local à conexão
   stream.getTracks().forEach(track => {
      pc.forEach(element => {
         element.addTrack(track, stream);
      });
   });
}, onLog);

pc.forEach((element, index) => {
   // Envia um novo 'candidate' local descoberto para os membros na sala
   element.onicecandidate = event => {
      if(event.candidate){
         onLog('Candidate enviado pelo pc[' + index + ']');
         sendMessage({'candidate': event.candidate}, clients[index].id);
      }
   };
   // Anexa o  fluxo de video recebido a sua respectiva tag video
   element.ontrack = event => {
      const stream = event.streams[0];
      if(!remoteVideo[index].srcObject || remoteVideo[index].srcObject.id !== stream.id){
         remoteVideo[index].srcObject = stream;
      }
   };
});
// Retorna a quantidade de clientes online no momento
function getQtdClients(){
   var qtdClients = 0;
   clients.forEach(client => {
      if(client.id != '') qtdClients++;
   });
   onLog(qtdClients + ' clientes online');
   return qtdClients;
}
// Ajusta o estilo dos videos conforme a quantidade de clientes online
function setVideoLayout(){
   switch(getQtdClients()){
   //switch(3){
      case 0:{
         localVideo.className = 'fullscreen';
         remoteVideo.forEach(video => video.className = '');
         break;
      }
      case 1:{
         localVideo.className = 'thumbnail';
         clients.forEach((client, index) => {
            if(client.id == ''){
               remoteVideo[index].className = '';
            }else{
               remoteVideo[index].className = 'fullscreen';
            }
         });
         break;
      }
      case 2:{
         allVideo.forEach(video => {
            video.className = 'group';
         });
         break;
      }
      case 3:{
         allVideo.forEach(video => {
            video.className = 'group';
         });
         break;
      }
   }
}
// Escreve no log se o mesmo estiver visivel
function onLog(msg){
   if(!showLog) return;
   log.value += msg + '\n';
};

drone.on('open', error => {
   if(error){
      onLog(error);
      return;
   }
   room = drone.subscribe(roomName);
   room.on('open', error => {
      if(error){
         onLog(error);
      }
   });
   // Evento que dispara somente 1 vez ao entrar na sala. Retorna os membros online
   room.on('members', members => {
      onLog('Entrei na sala com id = ' + drone.clientId + '. Usuarios online: ' + members.length);
      if(members.length > 1){
         members.forEach(member => {
            if(member.id != drone.clientId){
               for(var i = 0; i < 3; i++){
                  if(clients[i].id === ''){
                     clients[i].id = member.id;
                     onLog('Cliente com id = ' + member.id + ' presente na sala, foi adicionado à lista local');
                     break;
                  }
               }
            }
         });
      }
      startWebRTC(members.length);
   });
   // Adiciona à lista um usuário que acabou de entrar na sala
   room.on('member_join', member => {
      onLog('Um membro novo tentou entrar com id = ' + member.id);
      for(var i = 0; i < 3; i++){
         if(clients[i].id === ''){
            clients[i].id = member.id;
            onLog('Havia espaço. Ele conseguiu ficar.');
            break;
         }
      }
      setVideoLayout();
   });
   // Exclui da lista o usuário que acabou de sair da sala
   room.on('member_leave', ({id}) => {
      onLog('Saiu um membro com id = ' + id);
      const index = clients.findIndex(member => member.id === id);
      clients[index].id = '';
      setVideoLayout();
   });
});

// Envia uma mensagem pelo servidor de sinalização para os membros na  sala
function sendMessage(message, destinyId){
   if(destinyId == '') return;
   message.destiny = destinyId;
   onLog('Enviando para ' + message.destiny);
   drone.publish({
      room: roomName,
      message
   });
}

function startWebRTC(qtdMembers){
   // Se é o segundo usuário por diante, 'negotiationneeded' é criado e passa a oferecer o fluxo de video entre os usuários
   if(qtdMembers > 1){
      pc.forEach((element, index) => {
         element.onnegotiationneeded = (ev) => {
            element.createOffer().then((offer) => element.setLocalDescription(offer)).then(() => {
               sendMessage({'sdp': element.localDescription}, clients[index].id); onLog('SDP enviado pelo pc[' + index + ']');}).catch((err) => {
                  onLog(err);
               });
         }
      });
   }
   // Evento disparado sempre que chega uma nova mensagem do servidor de sinalização
   room.on('data', (message, client) => {
      if(message.destiny != drone.clientId) return;
      const index = clients.findIndex(member => member.id === client.id);
      if(message.sdp){ // Mensagem é uma descrição da sessão remota
         onLog('SDP recebido de ' + client.id);
         pc[index].setRemoteDescription(new RTCSessionDescription(message.sdp), () => {
            // Respondemos a mensagem com nossos dados
            if(pc[index].remoteDescription.type === 'offer'){
               pc[index].createAnswer().then((offer) => pc[index].setLocalDescription(offer)).then(() => {
                  sendMessage({'sdp': pc[index].localDescription}, clients[index].id); onLog('SDP enviado por pc[' + index + ']');}).catch((err) => {
                  onLog(err);
               });
            }
         }, onLog);
      }else if(message.candidate){ // Mensagem é um candidate ICE
         onLog('Candidate recebido de ' + client.id);
         // Adiciona à conexão local o novo ICE candidate recebido da conexão remota
         pc[index].addIceCandidate(new RTCIceCandidate(message.candidate), onLog, onLog);
      }
   });
}
